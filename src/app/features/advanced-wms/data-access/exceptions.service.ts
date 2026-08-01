import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { ExceptionRec, db } from './mock-data';

export interface ExceptionRow extends ExceptionRec {}

const ACCESSOR = (row: ExceptionRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class ExceptionsService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<ExceptionRow>> {
    const source = db.exceptions.filter((e) => !scope.length || scope.includes(e.warehouseCode));

    return this.api.simulate(source, { delayMs: 320 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.type, r.referenceId, r.owner ?? '', r.referenceType],
        }),
      ),
    );
  }

  totals(scope: string[]): Observable<{ open: number; investigating: number; resolved: number; critical: number }> {
    const rows = db.exceptions.filter((e) => !scope.length || scope.includes(e.warehouseCode));
    return this.api.simulate(
      {
        open: rows.filter((r) => r.status === 'open').length,
        investigating: rows.filter((r) => r.status === 'investigating').length,
        resolved: rows.filter((r) => r.status === 'resolved').length,
        critical: rows.filter((r) => r.severity === 'critical' && r.status !== 'resolved').length,
      },
      { delayMs: 200 },
    );
  }

  resolve(id: string, expectedVersion: number, note: string): Observable<ExceptionRow> {
    return this.api.simulate(id, { delayMs: 460, kind: 'write' }).pipe(
      map(() => {
        const record = db.exceptions.find((e) => e.id === id);
        if (!record) throw new ApiError('not-found', 'İstisna bulunamadı.');

        this.api.assertVersion(expectedVersion, record.version);

        if (record.status === 'resolved') {
          throw new ApiError('validation', 'Bu istisna zaten çözülmüş.');
        }
        if (note.trim().length < 6) {
          throw new ApiError('validation', 'Çözüm gerekçesi en az 6 karakter olmalıdır.');
        }

        record.status = 'resolved';
        record.resolutionNote = note.trim();
        record.version += 1;
        return { ...record };
      }),
    );
  }
}
