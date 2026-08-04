import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { CycleCountRec, db } from './mock-data';
import { VARIANCE_THRESHOLD_PCT, requiresSecondCount, variancePct } from './selectors';
import { translate } from '../../../core/i18n/i18n.service';

export interface CycleCountRow extends CycleCountRec {
  variance: number;
  variancePct: number;
  requiresSecondCount: boolean;
}

export interface CycleCountDraft {
  code: string;
  warehouseCode: string;
  scopeLabel: string;
  expectedQuantity: number;
}

function toRow(c: CycleCountRec, thresholdPct: number): CycleCountRow {
  return {
    ...c,
    variance: c.countedQuantity - c.expectedQuantity,
    variancePct: Math.round(variancePct(c.expectedQuantity, c.countedQuantity) * 10) / 10,
    requiresSecondCount: requiresSecondCount(c.expectedQuantity, c.countedQuantity, thresholdPct),
  };
}

const ACCESSOR = (row: CycleCountRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class CycleCountsService {
  private readonly api = inject(MockApiService);

  query(
    scope: string[],
    query: ListQuery,
    thresholdPct = VARIANCE_THRESHOLD_PCT,
  ): Observable<ListResult<CycleCountRow>> {
    const source = db.cycleCounts
      .filter((c) => !scope.length || scope.includes(c.warehouseCode))
      .map((c) => toRow(c, thresholdPct));

    return this.api.simulate(source, { delayMs: 320 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.code, r.scopeLabel, r.warehouseCode],
        }),
      ),
    );
  }

  isCodeAvailable(code: string): Observable<boolean> {
    const taken = db.cycleCounts.some((c) => c.code.toLowerCase() === code.trim().toLowerCase());
    return this.api.simulate(!taken, { delayMs: 360 });
  }

  create(draft: CycleCountDraft): Observable<CycleCountRow> {
    return this.api.simulate(draft, { delayMs: 480, kind: 'write' }).pipe(
      map((d) => {
        if (db.cycleCounts.some((c) => c.code.toLowerCase() === d.code.toLowerCase())) {
          throw new ApiError('conflict', translate('svc.codeTaken', { code: d.code }));
        }
        const record: CycleCountRec = {
          id: `cc-${db.cycleCounts.length + 1}`,
          code: d.code.toUpperCase(),
          warehouseCode: d.warehouseCode,
          scopeLabel: d.scopeLabel,
          expectedQuantity: d.expectedQuantity,
          countedQuantity: d.expectedQuantity,
          status: 'scheduled',
        };
        db.cycleCounts.unshift(record);
        return toRow(record, VARIANCE_THRESHOLD_PCT);
      }),
    );
  }
}
