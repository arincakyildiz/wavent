import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { PackageRec, ShipmentRec, db } from './mock-data';
import { translate } from '../../../core/i18n/i18n.service';
import { withinWeightTolerance } from './selectors';
import { DbPersistenceService } from './db-persistence.service';

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
  private readonly persistence = inject(DbPersistenceService);

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

  assignDoor(id: string, expectedVersion: number, door: string): Observable<ShipmentRow> {
    return this.api.simulate(id, { delayMs: 420, kind: 'write' }).pipe(
      map(() => {
        const shipment = this.findMutable(id, expectedVersion);
        if (!/^D-\d{2}$/.test(door.trim().toUpperCase())) {
          throw new ApiError('validation', translate('svc.invalidDoor'));
        }
        shipment.door = door.trim().toUpperCase();
        shipment.version += 1;
        return toRow(shipment);
      }),
      this.persistence.afterWrite(),
    );
  }

  loadNextPackage(id: string, expectedVersion: number): Observable<ShipmentRow> {
    return this.api.simulate(id, { delayMs: 460, kind: 'write' }).pipe(
      map(() => {
        const shipment = this.findMutable(id, expectedVersion);
        const nextCode = shipment.packageCodes.find((code) => !shipment.loadedPackageCodes.includes(code));
        if (!nextCode) throw new ApiError('validation', translate('svc.allPackagesLoaded'));
        const pkg = db.packages.find((record) => record.code === nextCode);
        if (!pkg) throw new ApiError('not-found', translate('svc.packageNotFound'));
        if (!pkg.contentVerified) throw new ApiError('validation', translate('svc.packageContentUnverified', { code: pkg.code }));
        if (pkg.status !== 'sealed' || !withinWeightTolerance(pkg)) {
          throw new ApiError('validation', translate('svc.packageNotShippable', { code: pkg.code }));
        }
        shipment.loadedPackageCodes.push(nextCode);
        shipment.status = 'loading';
        shipment.progressPct = Math.round((shipment.loadedPackageCodes.length / shipment.packageCodes.length) * 100);
        shipment.version += 1;
        return toRow(shipment);
      }),
      this.persistence.afterWrite(),
    );
  }

  close(id: string, expectedVersion: number, reason: string): Observable<ShipmentRow> {
    return this.api.simulate(id, { delayMs: 520, kind: 'write' }).pipe(
      map(() => {
        const shipment = this.findMutable(id, expectedVersion);
        if (reason.trim().length < 6) throw new ApiError('validation', translate('svc.reasonTooShort'));
        if (shipment.loadedPackageCodes.length !== shipment.packageCodes.length) {
          throw new ApiError('validation', translate('svc.shipmentLoadIncomplete'));
        }
        const packages = db.packages.filter((pkg) => shipment.packageCodes.includes(pkg.code));
        if (packages.some((pkg) => !pkg.contentVerified || pkg.status !== 'sealed' || !withinWeightTolerance(pkg))) {
          throw new ApiError('validation', translate('svc.shipmentPackagesInvalid'));
        }
        shipment.status = 'in-transit';
        shipment.progressPct = 100;
        shipment.closedAt = new Date().toISOString();
        shipment.version += 1;
        for (const pkg of packages) {
          pkg.status = 'shipped';
          pkg.version += 1;
        }
        return toRow(shipment);
      }),
      this.persistence.afterWrite(),
    );
  }

  private findMutable(id: string, expectedVersion: number): ShipmentRec {
    const shipment = db.shipments.find((record) => record.id === id || record.code === id);
    if (!shipment) throw new ApiError('not-found', translate('svc.shipmentNotFound'));
    this.api.assertVersion(expectedVersion, shipment.version);
    if (shipment.status === 'in-transit' || shipment.status === 'delivered') {
      throw new ApiError('validation', translate('svc.closedShipmentLocked'));
    }
    return shipment;
  }
}
