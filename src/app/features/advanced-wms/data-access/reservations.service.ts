import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { AllocationRec, db } from './mock-data';

export interface ReservationRow {
  id: string;
  orderNumber: string;
  sku: string;
  lot?: string;
  locationPath: string;
  warehouseCode: string;
  quantity: number;
  requested: number;
  strategy: 'FEFO' | 'FIFO';
  isPartial: boolean;
  isBackorder: boolean;
  overrideReason?: string;
  /** Single derived label the table and the filter both use. */
  fulfilment: 'full' | 'partial' | 'backorder';
}

function toRow(a: AllocationRec): ReservationRow {
  return {
    id: a.id,
    orderNumber: a.orderNumber,
    sku: a.skuCode,
    lot: a.lot,
    locationPath: a.locationPath,
    warehouseCode: a.warehouseCode,
    quantity: a.quantity,
    requested: a.requested,
    strategy: a.strategy,
    isPartial: a.isPartial,
    isBackorder: a.isBackorder,
    overrideReason: a.overrideReason,
    fulfilment: a.isBackorder ? 'backorder' : a.isPartial ? 'partial' : 'full',
  };
}

const ACCESSOR = (row: ReservationRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<ReservationRow>> {
    const source = db.allocations
      .filter((a) => !scope.length || scope.includes(a.warehouseCode))
      .map(toRow);

    return this.api.simulate(source, { delayMs: 330 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.orderNumber, r.sku, r.lot ?? ''],
        }),
      ),
    );
  }

  totals(scope: string[]): Observable<{ total: number; partial: number; backorder: number; overrides: number }> {
    const rows = db.allocations.filter((a) => !scope.length || scope.includes(a.warehouseCode));
    return this.api.simulate(
      {
        total: rows.length,
        partial: rows.filter((r) => r.isPartial && !r.isBackorder).length,
        backorder: rows.filter((r) => r.isBackorder).length,
        overrides: rows.filter((r) => r.overrideReason).length,
      },
      { delayMs: 200 },
    );
  }
}
