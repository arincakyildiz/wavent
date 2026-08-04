import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { PutawayRec, db } from './mock-data';
import { capacityVerdict } from './selectors';
import { translate } from '../../../core/i18n/i18n.service';

export interface PutawaySuggestionRow extends PutawayRec {
  skuName: string;
  /** Rule verdict surfaced to the UI so a blocked suggestion is visible before clicking. */
  capacityOk: boolean;
  /** Which constraint failed — weight, volume, product class or temperature (§12). */
  capacityViolations: string[];
}

/** One putaway drop is capped at 40 units, matching the suggestion generator. */
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
        if (!record) throw new ApiError('not-found', translate('svc.putawayNotFound'));

        this.api.assertVersion(expectedVersion, record.version);

        const row = toRow(record);
        if (!row.capacityOk) {
          throw new ApiError(
            'validation',
            translate('svc.locationUnfit', {
        path: record.suggestedLocationPath,
        violations: row.capacityViolations.join('; '),
      }),
          );
        }

        record.accepted = true;
        record.version += 1;
        return toRow(record);
      }),
    );
  }
}
