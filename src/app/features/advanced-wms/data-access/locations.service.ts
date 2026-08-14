import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { LocationRec, db } from './mock-data';
import { locationCapacityPct } from './selectors';
import { ApiError } from '../../../core/api/api-error';
import { translate } from '../../../core/i18n/i18n.service';
import { DbPersistenceService } from './db-persistence.service';
import { LOCATION_PATH_PATTERN, LOCATION_SEGMENT_PATTERN, MAX_VOLUME_M3 } from '../../../shared/validators/wms-validators';

export interface LocationDraft {
  warehouseCode: string;
  parentPath: string;
  code: string;
  type: LocationRec['type'];
  locationClass: LocationRec['locationClass'];
  maxWeightKg: number;
  maxVolumeM3: number;
}

export interface LocationRow extends LocationRec {
  capacityPct: number;
}

const ACCESSOR = (row: LocationRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class LocationsService {
  private readonly api = inject(MockApiService);
  private readonly persistence = inject(DbPersistenceService);

  query(scope: string[], query: ListQuery): Observable<ListResult<LocationRow>> {
    const source: LocationRow[] = db.locations
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

  create(draft: LocationDraft): Observable<LocationRow> {
    return this.api.simulate(draft, { delayMs: 460, kind: 'write' }).pipe(
      map((value) => {
        const parentPath = value.parentPath.trim().toUpperCase();
        const code = value.code.trim().toUpperCase();
        if ((parentPath && !LOCATION_PATH_PATTERN.test(parentPath)) || !LOCATION_SEGMENT_PATTERN.test(code)) {
          throw new ApiError('validation', translate('svc.invalidLocationPath'));
        }
        if (!Number.isFinite(value.maxVolumeM3) || value.maxVolumeM3 < 0 || value.maxVolumeM3 > MAX_VOLUME_M3) {
          throw new ApiError('validation', translate('svc.invalidVolume'));
        }
        const path = [parentPath, code].filter(Boolean).join('/');
        if (!path || db.locations.some((l) => l.warehouseCode === value.warehouseCode && l.path === path)) {
          throw new ApiError('conflict', translate('svc.locationExists'));
        }
        const record: LocationRec = {
          id: `loc-${db.locations.length + 1}`,
          path,
          warehouseCode: value.warehouseCode,
          type: value.type,
          locationClass: value.locationClass,
          status: 'active',
          maxWeightKg: value.maxWeightKg,
          maxVolumeM3: value.maxVolumeM3,
          usedWeightKg: 0,
          usedVolumeM3: 0,
          version: 1,
        };
        db.locations.push(record);
        return { ...record, capacityPct: 0 };
      }),
      this.persistence.afterWrite(),
    );
  }

  setStatus(id: string, expectedVersion: number, status: LocationRec['status']): Observable<LocationRow> {
    return this.api.simulate(id, { delayMs: 420, kind: 'write' }).pipe(
      map(() => {
        const record = db.locations.find((location) => location.id === id);
        if (!record) throw new ApiError('not-found', translate('svc.locationNotFound'));
        this.api.assertVersion(expectedVersion, record.version);
        record.status = status;
        record.version += 1;
        return { ...record, capacityPct: locationCapacityPct(record) };
      }),
      this.persistence.afterWrite(),
    );
  }
}
