import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { PickTaskRec, db } from './mock-data';

export interface PickTaskRow extends PickTaskRec {
  locationCount: number;
  progressPct: number;
}

function toRow(t: PickTaskRec): PickTaskRow {
  return {
    ...t,
    locationCount: t.route.length,
    progressPct: t.lineCount ? Math.round((t.pickedLines / t.lineCount) * 100) : 0,
  };
}

const ACCESSOR = (row: PickTaskRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class PickingService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<PickTaskRow>> {
    const source = db.pickTasks
      .filter((t) => !scope.length || scope.includes(t.warehouseCode))
      .map(toRow);

    return this.api.simulate(source, { delayMs: 320 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.code, r.waveName, r.assignedTo ?? '', r.type],
        }),
      ),
    );
  }

  totals(scope: string[]): Observable<{ total: number; exceptions: number; inProgress: number }> {
    const rows = db.pickTasks.filter((t) => !scope.length || scope.includes(t.warehouseCode));
    return this.api.simulate(
      {
        total: rows.length,
        exceptions: rows.filter((r) => r.status === 'exception').length,
        inProgress: rows.filter((r) => r.status === 'in-progress').length,
      },
      { delayMs: 200 },
    );
  }
}
