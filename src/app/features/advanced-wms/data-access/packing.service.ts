import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { PackageRec, db } from './mock-data';
import { withinWeightTolerance } from './selectors';

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
   * Supervisor override for an out-of-tolerance package. Requires the reason captured
   * by the confirm dialog, and refuses to run on a package that is already compliant.
   */
  approveWeight(id: string, expectedVersion: number, reason: string): Observable<PackageRow> {
    return this.api.simulate(id, { delayMs: 480, kind: 'write' }).pipe(
      map(() => {
        const record = db.packages.find((p) => p.id === id);
        if (!record) throw new ApiError('not-found', 'Paket bulunamadı.');

        this.api.assertVersion(expectedVersion, record.version);

        if (withinWeightTolerance(record)) {
          throw new ApiError('validation', 'Paket tolerans içinde; supervisor onayı gerekmiyor.');
        }
        if (!reason.trim()) {
          throw new ApiError('validation', 'Supervisor onayı için gerekçe zorunludur.');
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
