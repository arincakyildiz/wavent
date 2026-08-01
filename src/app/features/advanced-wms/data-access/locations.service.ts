import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { LocationRec, db } from './mock-data';
import { locationCapacityPct } from './selectors';

export interface LocationRow extends LocationRec {
  capacityPct: number;
}

const ACCESSOR = (row: LocationRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class LocationsService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<LocationRow>> {
    const source: LocationRow[] = db.locations
      .filter((l) => l.type === 'bin' || l.type === 'staging')
      .filter((l) => !scope.length || scope.includes(l.warehouseCode))
      .map((l) => ({ ...l, capacityPct: locationCapacityPct(l) }));

    return this.api.simulate(source, { delayMs: 300 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.path, r.warehouseCode, r.locationClass, r.type],
        }),
      ),
    );
  }
}
