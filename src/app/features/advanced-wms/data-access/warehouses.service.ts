import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { WarehouseRec, db } from './mock-data';
import { inventoryByWarehouse, locationCount, warehouseCapacityPct } from './selectors';
import { translate } from '../../../core/i18n/i18n.service';

export interface WarehouseSummary {
  id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  operatingHours: { open: string; close: string };
  isActive: boolean;
  locationCount: number;
  capacityUsedPct: number;
  inventoryUnits: number;
}

export interface WarehouseDraft {
  code: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  open: string;
  close: string;
}

function toSummary(w: WarehouseRec): WarehouseSummary {
  const units = inventoryByWarehouse().find((i) => i.code === w.code)?.units ?? 0;
  return {
    id: w.id,
    code: w.code,
    name: w.name,
    city: w.city,
    country: w.country,
    timezone: w.timezone,
    operatingHours: { open: w.open, close: w.close },
    isActive: w.isActive,
    locationCount: locationCount(w.code),
    capacityUsedPct: warehouseCapacityPct(w.code),
    inventoryUnits: units,
  };
}

const ACCESSOR = (row: WarehouseSummary, key: string): unknown => {
  switch (key) {
    case 'capacityUsedPct':
      return row.capacityUsedPct;
    case 'inventoryUnits':
      return row.inventoryUnits;
    case 'locationCount':
      return row.locationCount;
    case 'status':
      return row.isActive ? 'active' : 'inactive';
    default:
      return (row as unknown as Record<string, unknown>)[key];
  }
};

@Injectable({ providedIn: 'root' })
export class WarehousesService {
  private readonly api = inject(MockApiService);

  /** Server-like query: scope, search, filter, sort and page all applied remotely. */
  query(scope: string[], query: ListQuery): Observable<ListResult<WarehouseSummary>> {
    const source = db.warehouses.filter((w) => !scope.length || scope.includes(w.code)).map(toSummary);

    return this.api
      .simulate(source, { delayMs: 320 })
      .pipe(
        map((rows) =>
          runQuery(rows, query, {
            accessor: ACCESSOR,
            searchable: (r) => [r.code, r.name, r.city, r.country],
          }),
        ),
      );
  }

  /** Async uniqueness check backing the create form's code validator. */
  isCodeAvailable(code: string): Observable<boolean> {
    const taken = db.warehouses.some((w) => w.code.toLowerCase() === code.trim().toLowerCase());
    return this.api.simulate(!taken, { delayMs: 420 });
  }

  create(draft: WarehouseDraft): Observable<WarehouseSummary> {
    return this.api
      .simulate(draft, { delayMs: 520, kind: 'write' })
      .pipe(
        map((d) => {
          // Server-side re-check: the async validator can go stale between blur and submit.
          if (db.warehouses.some((w) => w.code.toLowerCase() === d.code.toLowerCase())) {
            throw new ApiError('conflict', translate('svc.warehouseCodeTaken', { code: d.code }));
          }

          const record: WarehouseRec = {
            id: `wh-${db.warehouses.length + 1}`,
            code: d.code.toUpperCase(),
            name: d.name,
            city: d.city,
            country: d.country,
            lon: 0,
            lat: 0,
            timezone: d.timezone,
            open: d.open,
            close: d.close,
            isActive: true,
            version: 1,
          };
          db.warehouses.push(record);
          return toSummary(record);
        }),
      );
  }
}
