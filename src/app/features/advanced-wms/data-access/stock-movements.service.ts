import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { MovementRec, db } from './mock-data';

export type MovementType = MovementRec['type'];
export type StockMovementRow = MovementRec;

const ACCESSOR = (row: StockMovementRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class StockMovementsService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<StockMovementRow>> {
    const source = db.movements.filter((m) => !scope.length || scope.includes(m.warehouseCode));

    return this.api.simulate(source, { delayMs: 340 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.skuCode, r.reasonCode, r.lot ?? '', r.performedBy],
        }),
      ),
    );
  }

  /** Totals are computed over the full scoped set, not just the visible page. */
  totals(scope: string[]): Observable<{ count: number; inbound: number; outbound: number }> {
    const rows = db.movements.filter((m) => !scope.length || scope.includes(m.warehouseCode));
    return this.api.simulate(
      {
        count: rows.length,
        inbound: rows.reduce((s, r) => (r.quantity > 0 ? s + r.quantity : s), 0),
        outbound: rows.reduce((s, r) => (r.quantity < 0 ? s + r.quantity : s), 0),
      },
      { delayMs: 200 },
    );
  }
}
