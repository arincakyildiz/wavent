import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { PutawayRec, db } from './mock-data';
import { capacityVerdict } from './selectors';
import { translate } from '../../../core/i18n/i18n.service';
import { DbPersistenceService } from './db-persistence.service';
import { StockStatus } from '../models/entities';

export interface PutawaySuggestionRow extends PutawayRec {
  skuName: string;
  /** Rule verdict surfaced to the UI so a blocked suggestion is visible before clicking. */
  capacityOk: boolean;
  /** Which constraint failed — weight, volume, product class or temperature (§12). */
  capacityViolations: string[];
}

/** Capacity is evaluated per handling-unit drop; the accepted suggestion still moves its full quantity. */
function dropQuantity(p: PutawayRec): number {
  return Math.min(p.quantity, 40);
}

function toRow(p: PutawayRec): PutawaySuggestionRow {
  const sku = db.skus.find((s) => s.code === p.skuCode);
  const loc = db.locations.find(
    (l) => l.warehouseCode === p.warehouseCode && l.path === p.suggestedLocationPath,
  );

  const verdict =
    loc && sku ? capacityVerdict(loc, sku, dropQuantity(p)) : { ok: true, violations: [] };

  return {
    ...p,
    skuName: sku?.name ?? p.skuCode,
    capacityOk: verdict.ok,
    capacityViolations: verdict.violations,
  };
}

const ACCESSOR = (row: PutawaySuggestionRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class PutawayService {
  private readonly api = inject(MockApiService);
  private readonly persistence = inject(DbPersistenceService);

  query(scope: string[], query: ListQuery): Observable<ListResult<PutawaySuggestionRow>> {
    const source = db.putaway
      .filter((p) => !scope.length || scope.includes(p.warehouseCode))
      .map(toRow);

    return this.api.simulate(source, { delayMs: 320 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.skuCode, r.skuName, r.lot ?? '', r.suggestedLocationPath, r.asnNumber],
        }),
      ),
    );
  }

  /**
   * Accepts a suggestion. Validates capacity server-side and uses the row version for
   * optimistic-concurrency, so a stale screen gets a conflict rather than silently
   * overwriting someone else's decision.
   */
  accept(id: string, expectedVersion: number, overrideReason?: string): Observable<PutawaySuggestionRow> {
    return this.api.simulate(id, { delayMs: 460, kind: 'write' }).pipe(
      map(() => {
        const record = db.putaway.find((p) => p.id === id);
        if (!record) throw new ApiError('not-found', translate('svc.putawayNotFound'));

        this.api.assertVersion(expectedVersion, record.version);
        if (record.accepted) {
          throw new ApiError('validation', translate('svc.putawayAlreadyAccepted'));
        }

        const row = toRow(record);
        if (!row.capacityOk && (overrideReason?.trim().length ?? 0) < 6) {
          throw new ApiError('validation', translate('svc.overrideReasonRequired'));
        }

        const sku = db.skus.find((item) => item.code === record.skuCode);
        const location = db.locations.find(
          (item) =>
            item.warehouseCode === record.warehouseCode &&
            item.path === record.suggestedLocationPath,
        );
        if (!sku || !location) {
          throw new ApiError('validation', translate('svc.putawayTargetMissing'));
        }

        const quantity = record.quantity;
        const existing = db.balances.find(
          (balance) =>
            balance.skuCode === record.skuCode &&
            balance.lot === record.lot &&
            balance.warehouseCode === record.warehouseCode &&
            balance.locationPath === record.suggestedLocationPath &&
            balance.status === StockStatus.Available &&
            !balance.serial,
        );
        if (existing) {
          existing.quantity += quantity;
          existing.version += 1;
        } else {
          db.balances.push({
            id: `bal-putaway-${db.balances.length + 1}`,
            skuCode: record.skuCode,
            lot: record.lot,
            locationPath: record.suggestedLocationPath,
            warehouseCode: record.warehouseCode,
            quantity,
            status: StockStatus.Available,
            version: 1,
          });
        }
        location.usedWeightKg += sku.weightKg * quantity;
        location.usedVolumeM3 += sku.volumeM3 * quantity;
        location.version += 1;
        db.movements.unshift({
          id: `mv-live-${db.movements.length + 1}`,
          at: new Date().toISOString(),
          skuCode: record.skuCode,
          lot: record.lot,
          warehouseCode: record.warehouseCode,
          quantity,
          fromLocation: 'STAGE/IN',
          toLocation: record.suggestedLocationPath,
          type: 'putaway',
          reasonCode: record.asnNumber,
          performedBy: 'Current user',
        });

        record.accepted = true;
        record.version += 1;
        return toRow(record);
      }),
      this.persistence.afterWrite(),
    );
  }
}
