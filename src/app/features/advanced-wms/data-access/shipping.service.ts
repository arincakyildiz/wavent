import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { PackageRec, ShipmentRec, db } from './mock-data';
import { translate } from '../../../core/i18n/i18n.service';

export interface ShipmentRow extends ShipmentRec {
  packageCount: number;
}

export interface ShipmentPackageRow extends PackageRec {
  skuSummary: string;
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

  getById(id: string): Observable<ShipmentRow> {
    const found = db.shipments.find((s) => s.id === id || s.code === id);
    return this.api.simulate(found, { delayMs: 280 }).pipe(
      map((s) => {
        if (!s) throw new ApiError('not-found', translate('svc.shipmentNotFound'));
        return toRow(s);
      }),
    );
  }

  getPackages(id: string): Observable<ShipmentPackageRow[]> {
    const shipment = db.shipments.find((s) => s.id === id || s.code === id);
    const rows: ShipmentPackageRow[] = shipment
      ? db.packages
          .filter((p) => shipment.packageCodes.includes(p.code))
          .map((p) => ({
            ...p,
            skuSummary: translate('shippingDetail.itemCount', { count: p.itemCount }),
          }))
      : [];

    return this.api.simulate(rows, { delayMs: 280 });
  }
}
