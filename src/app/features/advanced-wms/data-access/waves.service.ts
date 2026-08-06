import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { WaveStatus } from '../models/entities';
import { WaveRec, db } from './mock-data';
import { WaveOrderStatus, waveOrderStatuses } from './selectors';
import { translate } from '../../../core/i18n/i18n.service';

export type { WaveOrderStatus };

export interface WaveRow {
  id: string;
  name: string;
  warehouseCode: string;
  zone?: string;
  carrier: string;
  cutOffTime: string;
  orderCount: number;
  capacityUsedPct: number;
  status: WaveStatus;
  version: number;
  /** Orders that would fail or be at risk if published now. */
  riskCount: number;
}

export interface WaveDraft {
  name: string;
  warehouseCode: string;
  zone?: string;
  carrier: string;
  cutOffTime: string;
  minPriority: number;
  maxOrders: number;
}

export interface ReleaseResult {
  wave: WaveRow;
  released: string[];
  failed: { orderNumber: string; reason: string }[];
}

export interface WaveOrderCandidate {
  orderNumber: string;
  priority: number;
  route: string;
}

function toRow(w: WaveRec): WaveRow {
  const statuses = waveOrderStatuses(w.id);
  return {
    id: w.id,
    name: w.name,
    warehouseCode: w.warehouseCode,
    zone: w.zone,
    carrier: w.carrier,
    cutOffTime: w.cutOffTime,
    orderCount: w.orderNumbers.length,
    capacityUsedPct: w.capacityUsedPct,
    status: w.status,
    version: w.version,
    riskCount: statuses.filter((s) => s.status !== 'ok').length,
  };
}

const ACCESSOR = (row: WaveRow, key: string): unknown => (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class WavesService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<WaveRow>> {
    const source = db.waves.filter((w) => !scope.length || scope.includes(w.warehouseCode)).map(toRow);

    return this.api.simulate(source, { delayMs: 330 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.name, r.carrier, r.warehouseCode, r.zone ?? ''],
        }),
      ),
    );
  }

  getById(id: string): Observable<WaveRow> {
    const found = db.waves.find((w) => w.id === id);
    return this.api.simulate(found, { delayMs: 280 }).pipe(
      map((w) => {
        if (!w) throw new ApiError('not-found', translate('svc.waveNotFound'));
        return toRow(w);
      }),
    );
  }

  getOrders(id: string): Observable<WaveOrderStatus[]> {
    return this.api.simulate(waveOrderStatuses(id), { delayMs: 280 });
  }

  isNameAvailable(name: string): Observable<boolean> {
    const taken = db.waves.some((w) => w.name.toLowerCase() === name.trim().toLowerCase());
    return this.api.simulate(!taken, { delayMs: 380 });
  }

  create(draft: WaveDraft): Observable<WaveRow> {
    return this.api.simulate(draft, { delayMs: 520, kind: 'write' }).pipe(
      map((d) => {
        if (db.waves.some((w) => w.name.toLowerCase() === d.name.toLowerCase())) {
          throw new ApiError('conflict', translate('svc.waveNameTaken', { name: d.name }));
        }

        // Only unwaved, allocated orders of the right warehouse/priority are eligible.
        const alreadyWaved = new Set(db.waves.flatMap((w) => w.orderNumbers));
        const candidates = db.orders
          .filter(
            (o) =>
              o.warehouseCode === d.warehouseCode &&
              o.priority <= d.minPriority &&
              !alreadyWaved.has(o.number) &&
              db.allocations.some((a) => a.orderNumber === o.number && a.quantity > 0),
          )
          .slice(0, d.maxOrders);

        if (!candidates.length) {
          throw new ApiError('validation', translate('svc.noMatchingOrders'));
        }

        const record: WaveRec = {
          id: `wv-${db.waves.length + 1}`,
          name: d.name,
          warehouseCode: d.warehouseCode,
          zone: d.zone || undefined,
          carrier: d.carrier,
          cutOffTime: d.cutOffTime,
          orderNumbers: candidates.map((o) => o.number),
          capacityUsedPct: Math.min(100, 25 + candidates.length * 6),
          status: 'planned',
          version: 1,
        };
        for (const o of candidates) o.status = 'waved';
        db.waves.unshift(record);
        return toRow(record);
      }),
    );
  }

  /**
   * Publishes a wave. Returns a per-order result: orders short on stock stay behind
   * with a reason instead of failing the whole release (§11 partial result).
   */
  release(id: string, expectedVersion: number): Observable<ReleaseResult> {
    return this.api.simulate(id, { delayMs: 620, kind: 'write' }).pipe(
      map(() => {
        const record = db.waves.find((w) => w.id === id);
        if (!record) throw new ApiError('not-found', translate('svc.waveNotFound'));
        if (record.status !== 'planned' && record.status !== 'draft') {
          throw new ApiError('validation', translate('svc.onlyDraftRelease'));
        }

        this.api.assertVersion(expectedVersion, record.version);

        const statuses = waveOrderStatuses(id);
        const failed = statuses
          .filter((s) => s.status === 'stock-shortage')
          .map((s) => ({ orderNumber: s.orderNumber, reason: s.reason ?? translate('sel.stockShortageFallback') }));
        const released = statuses.filter((s) => s.status !== 'stock-shortage').map((s) => s.orderNumber);

        if (!released.length) {
          throw new ApiError('validation', translate('svc.noOrderReleased'));
        }

        record.status = 'released';
        record.version += 1;
        for (const number of released) {
          const order = db.orders.find((o) => o.number === number);
          if (order) order.status = 'picking';
        }

        return { wave: toRow(record), released, failed };
      }),
    );
  }

  eligibleOrders(id: string): Observable<WaveOrderCandidate[]> {
    const wave = db.waves.find((record) => record.id === id);
    const used = new Set(db.waves.flatMap((record) => record.orderNumbers));
    const rows = wave
      ? db.orders
          .filter(
            (order) =>
              order.warehouseCode === wave.warehouseCode &&
              !used.has(order.number) &&
              db.allocations.some((allocation) => allocation.orderNumber === order.number && allocation.quantity > 0),
          )
          .map((order) => ({ orderNumber: order.number, priority: order.priority, route: order.route }))
      : [];
    return this.api.simulate(rows, { delayMs: 280 });
  }

  addOrder(id: string, expectedVersion: number, orderNumber: string, reason?: string): Observable<WaveRow> {
    return this.api.simulate(id, { delayMs: 480, kind: 'write' }).pipe(
      map(() => {
        const wave = this.findEditable(id, expectedVersion, reason);
        const order = db.orders.find((record) => record.number === orderNumber);
        if (!order || order.warehouseCode !== wave.warehouseCode) {
          throw new ApiError('validation', translate('svc.orderNotEligible'));
        }
        if (db.waves.some((record) => record.orderNumbers.includes(orderNumber))) {
          throw new ApiError('conflict', translate('svc.orderAlreadyWaved'));
        }
        wave.orderNumbers.push(orderNumber);
        wave.capacityUsedPct = Math.min(100, wave.capacityUsedPct + 6);
        wave.version += 1;
        order.status = wave.status === 'released' ? 'picking' : 'waved';
        return toRow(wave);
      }),
    );
  }

  removeOrder(id: string, expectedVersion: number, orderNumber: string, reason?: string): Observable<WaveRow> {
    return this.api.simulate(id, { delayMs: 480, kind: 'write' }).pipe(
      map(() => {
        const wave = this.findEditable(id, expectedVersion, reason);
        const index = wave.orderNumbers.indexOf(orderNumber);
        if (index < 0) throw new ApiError('not-found', translate('svc.orderNotInWave'));
        if (wave.orderNumbers.length === 1) throw new ApiError('validation', translate('svc.waveCannotBeEmpty'));
        wave.orderNumbers.splice(index, 1);
        wave.capacityUsedPct = Math.max(0, wave.capacityUsedPct - 6);
        wave.version += 1;
        const order = db.orders.find((record) => record.number === orderNumber);
        if (order) order.status = 'allocated';
        return toRow(wave);
      }),
    );
  }

  private findEditable(id: string, expectedVersion: number, reason?: string): WaveRec {
    const wave = db.waves.find((record) => record.id === id);
    if (!wave) throw new ApiError('not-found', translate('svc.waveNotFound'));
    this.api.assertVersion(expectedVersion, wave.version);
    if (wave.status === 'completed' || wave.status === 'cancelled') {
      throw new ApiError('validation', translate('svc.waveLocked'));
    }
    if (wave.status === 'released' && (reason?.trim().length ?? 0) < 6) {
      throw new ApiError('validation', translate('svc.releasedWaveReasonRequired'));
    }
    return wave;
  }
}
