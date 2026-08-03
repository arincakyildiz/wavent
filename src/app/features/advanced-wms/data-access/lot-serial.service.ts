import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import {
  LotHealth,
  LotRow,
  SerialIssue,
  lotRows,
  serialIntegrityIssues,
  serialIsAvailable,
} from './selectors';

export type { LotHealth, LotRow, SerialIssue };

const ACCESSOR = (row: LotRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class LotSerialService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<LotRow>> {
    return this.api.simulate(lotRows(scope), { delayMs: 320 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.lot, r.serial ?? '', r.skuCode, r.skuName],
        }),
      ),
    );
  }

  /** §10: serial-rule breaches in scope — missing, duplicated or multi-unit serials. */
  serialIssues(scope: string[]): Observable<SerialIssue[]> {
    return this.api.simulate(serialIntegrityIssues(scope), { delayMs: 240 });
  }

  /** Backs the async uniqueness validator on any form that captures a serial. */
  isSerialAvailable(skuCode: string, serial: string): Observable<boolean> {
    return this.api.simulate(serialIsAvailable(skuCode, serial), { delayMs: 380 });
  }
}
