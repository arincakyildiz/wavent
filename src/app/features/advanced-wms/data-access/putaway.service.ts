import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { PutawayRec, db } from './mock-data';
import { fitsCapacity } from './selectors';

export interface PutawaySuggestionRow extends PutawayRec {
  skuName: string;
  /** Rule verdict surfaced to the UI so a blocked suggestion is visible before clicking. */
  capacityOk: boolean;
}

function toRow(p: PutawayRec): PutawaySuggestionRow {
  const sku = db.skus.find((s) => s.code === p.skuCode);
  const loc = db.locations.find(
    (l) => l.warehouseCode === p.warehouseCode && l.path === p.suggestedLocationPath,
  );
  const addedWeight = (sku?.weightKg ?? 1) * Math.min(p.quantity, 40);

  return {
    ...p,
    skuName: sku?.name ?? p.skuCode,
    capacityOk: loc ? fitsCapacity(loc, addedWeight) : true,
  };
}

const ACCESSOR = (row: PutawaySuggestionRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class PutawayService {
  private readonly api = inject(MockApiService);

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
  accept(id: string, expectedVersion: number): Observable<PutawaySuggestionRow> {
    return this.api.simulate(id, { delayMs: 460, kind: 'write' }).pipe(
      map(() => {
        const record = db.putaway.find((p) => p.id === id);
        if (!record) throw new ApiError('not-found', 'Putaway önerisi bulunamadı.');

        this.api.assertVersion(expectedVersion, record.version);

        const row = toRow(record);
        if (!row.capacityOk) {
          throw new ApiError(
            'validation',
            `${record.suggestedLocationPath} kapasitesi bu miktar için yetersiz.`,
          );
        }

        record.accepted = true;
        record.version += 1;
        return toRow(record);
      }),
    );
  }
}
