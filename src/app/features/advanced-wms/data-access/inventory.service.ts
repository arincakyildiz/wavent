import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { StockStatus } from '../models/entities';
import { db } from './mock-data';
import { SkuStock, balancesInScope, skuStock, skuStockFor } from './selectors';
import { translate } from '../../../core/i18n/i18n.service';

export type InventoryRow = SkuStock;

export interface InventoryLotRow {
  id: string;
  lot: string;
  serial?: string;
  locationPath: string;
  warehouseCode: string;
  quantity: number;
  status: StockStatus;
  expiryDate?: string;
  version: number;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: string;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  runningBalance: number;
  reasonCode: string;
}

const ACCESSOR = (row: InventoryRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<InventoryRow>> {
    return this.api.simulate(skuStock(scope), { delayMs: 340 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.skuCode, r.name],
        }),
      ),
    );
  }

  getBySku(skuCode: string, scope: string[]): Observable<InventoryRow> {
    return this.api.simulate(skuStockFor(skuCode, scope), { delayMs: 300 }).pipe(
      map((row) => {
        if (!row) throw new ApiError('not-found', translate('svc.stockNotFound', { code: skuCode }));
        return row;
      }),
    );
  }

  getLots(skuCode: string, scope: string[]): Observable<InventoryLotRow[]> {
    const rows = balancesInScope(scope)
      .filter((b) => b.skuCode === skuCode)
      .map((b) => ({
        id: b.id,
        lot: b.lot ?? '—',
        serial: b.serial,
        locationPath: b.locationPath,
        warehouseCode: b.warehouseCode,
        quantity: b.quantity,
        status: b.status,
        expiryDate: b.expiryDate,
        version: b.version,
      }));

    return this.api.simulate(rows, { delayMs: 280 });
  }

  /**
   * Movement history with a running balance. Computed from oldest to newest so the
   * balance column reads as a real ledger, then reversed for display.
   */
  getLedger(skuCode: string, scope: string[]): Observable<LedgerEntry[]> {
    const movements = db.movements
      .filter((m) => m.skuCode === skuCode && (!scope.length || scope.includes(m.warehouseCode)))
      .slice()
      .sort((a, b) => a.at.localeCompare(b.at));

    const opening = skuStockFor(skuCode, scope)?.onHand ?? 0;
    const net = movements.reduce((s, m) => s + m.quantity, 0);
    let running = opening - net;

    const entries = movements.map((m) => {
      running += m.quantity;
      return {
        id: m.id,
        date: m.at,
        type: m.type,
        quantity: m.quantity,
        fromLocation: m.fromLocation,
        toLocation: m.toLocation,
        runningBalance: running,
        reasonCode: m.reasonCode,
      } satisfies LedgerEntry;
    });

    return this.api.simulate(entries.reverse(), { delayMs: 300 });
  }

  adjustBalance(
    id: string,
    expectedVersion: number,
    quantity: number,
    status: StockStatus,
    reason: string,
  ): Observable<InventoryLotRow> {
    return this.api.simulate(id, { delayMs: 500, kind: 'write' }).pipe(
      map(() => {
        const balance = db.balances.find((record) => record.id === id);
        if (!balance) throw new ApiError('not-found', translate('svc.balanceNotFound'));
        this.api.assertVersion(expectedVersion, balance.version);
        if (!Number.isInteger(quantity) || quantity < 0) {
          throw new ApiError('validation', translate('svc.invalidAdjustmentQuantity'));
        }
        if (reason.trim().length < 6) throw new ApiError('validation', translate('svc.reasonTooShort'));
        const delta = quantity - balance.quantity;
        balance.quantity = quantity;
        balance.status = status;
        balance.version += 1;
        db.movements.unshift({
          id: `mv-live-${db.movements.length + 1}`,
          at: new Date().toISOString(),
          skuCode: balance.skuCode,
          lot: balance.lot,
          warehouseCode: balance.warehouseCode,
          quantity: delta,
          fromLocation: balance.locationPath,
          toLocation: balance.locationPath,
          type: 'adjustment',
          reasonCode: reason.trim(),
          performedBy: 'Current user',
        });
        return {
          id: balance.id,
          lot: balance.lot ?? '—',
          serial: balance.serial,
          locationPath: balance.locationPath,
          warehouseCode: balance.warehouseCode,
          quantity: balance.quantity,
          status: balance.status,
          expiryDate: balance.expiryDate,
          version: balance.version,
        };
      }),
    );
  }
}
