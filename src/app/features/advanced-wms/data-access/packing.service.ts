import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { PackageRec, db } from './mock-data';
import { withinWeightTolerance } from './selectors';
import { translate } from '../../../core/i18n/i18n.service';

export interface PackageRow extends PackageRec {
  weightOk: boolean;
  deviationKg: number;
}

function toRow(p: PackageRec): PackageRow {
  return {
    ...p,
    weightOk: withinWeightTolerance(p),
    deviationKg: Math.round((p.weightKg - p.expectedWeightKg) * 10) / 10,
  };
}

const ACCESSOR = (row: PackageRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class PackingService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<PackageRow>> {
    const source = db.packages
      .filter((p) => !scope.length || scope.includes(p.warehouseCode))
      .map(toRow);

    return this.api.simulate(source, { delayMs: 320 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.code, r.orderNumber],
        }),
      ),
    );
  }

  /**
   * Records a weight read off the bench scale (§2 device simulation).
   *
   * The reading replaces the measured weight but never the expectation — that is what
   * keeps the tolerance rule meaningful: a drifted scale or a mis-loaded package shows
   * up as out-of-tolerance needing supervisor approval, rather than silently
   * redefining what the package was supposed to weigh.
   */
  recordWeight(id: string, expectedVersion: number, weightKg: number): Observable<PackageRow> {
    return this.api.simulate(id, { delayMs: 420, kind: 'write' }).pipe(
      map(() => {
        const record = db.packages.find((p) => p.id === id);
        if (!record) throw new ApiError('not-found', translate('svc.packageNotFound'));

        this.api.assertVersion(expectedVersion, record.version);

        if (record.status === 'shipped') {
          throw new ApiError('validation', translate('svc.shippedCannotReweigh'));
        }
        if (!Number.isFinite(weightKg) || weightKg <= 0) {
          throw new ApiError('validation', translate('svc.invalidScaleReading'));
        }

        record.weightKg = Math.round(weightKg * 10) / 10;
        // A fresh reading outside tolerance puts the package back on hold.
        record.status = withinWeightTolerance(record) ? 'sealed' : 'weight-hold';
        record.version += 1;

        return toRow(record);
      }),
    );
  }

  /**
   * Supervisor override for an out-of-tolerance package. Requires the reason captured
   * by the confirm dialog, and refuses to run on a package that is already compliant.
   */
  approveWeight(id: string, expectedVersion: number, reason: string): Observable<PackageRow> {
    return this.api.simulate(id, { delayMs: 480, kind: 'write' }).pipe(
      map(() => {
        const record = db.packages.find((p) => p.id === id);
        if (!record) throw new ApiError('not-found', translate('svc.packageNotFound'));

        this.api.assertVersion(expectedVersion, record.version);

        if (withinWeightTolerance(record)) {
          throw new ApiError('validation', translate('svc.withinTolerance'));
        }
        if (!reason.trim()) {
          throw new ApiError('validation', translate('svc.approvalReasonRequired'));
        }

        // Accepting the deviation means the recorded expectation moves to the actual.
        record.expectedWeightKg = record.weightKg;
        record.status = 'sealed';
        record.contentVerified = true;
        record.version += 1;
        return toRow(record);
      }),
    );
  }
}
