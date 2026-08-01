import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { ShipmentRec, db } from './mock-data';

export interface ShipmentRow extends ShipmentRec {
  packageCount: number;
}

function toRow(s: ShipmentRec): ShipmentRow {
  return { ...s, packageCount: s.packageCodes.length };
}

const ACCESSOR = (row: ShipmentRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class ShippingService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<ShipmentRow>> {
    const source = db.shipments
      .filter((s) => !scope.length || scope.includes(s.warehouseCode))
      .map(toRow);

    return this.api.simulate(source, { delayMs: 320 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.code, r.carrier, r.door],
        }),
      ),
    );
  }
}
