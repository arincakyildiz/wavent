import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { LotHealth, LotRow, lotRows } from './selectors';

export type { LotHealth, LotRow };

const ACCESSOR = (row: LotRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class LotSerialService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<LotRow>> {
    return this.api.simulate(lotRows(scope), { delayMs: 320 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.lot, r.serial ?? '', r.skuCode, r.skuName],
        }),
      ),
    );
  }
}
