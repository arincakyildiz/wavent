import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { ASNStatus, ReceiptLineStatus } from '../models/entities';
import { AsnRec, ReceiptLineRec, db } from './mock-data';
import { translate } from '../../../core/i18n/i18n.service';

export interface AsnRow {
  id: string;
  number: string;
  supplierName: string;
  warehouseCode: string;
  expectedDate: string;
  status: ASNStatus;
  lineCount: number;
  /** Derived once here so list and detail agree. */
  discrepancyCount: number;
}

export interface ReceiptLineRow extends ReceiptLineRec {
  skuName: string;
}

export interface AsnDraft {
  number: string;
  supplierName: string;
  warehouseCode: string;
  expectedDate: string;
}

const DISCREPANT: ReceiptLineStatus[] = ['short', 'over', 'damaged', 'quarantined'];

function toRow(a: AsnRec): AsnRow {
  const lines = db.receiptLines.filter((l) => l.asnNumber === a.number);
  return {
    id: a.id,
    number: a.number,
    supplierName: a.supplierName,
    warehouseCode: a.warehouseCode,
    expectedDate: a.expectedDate,
    status: a.status,
    lineCount: lines.length,
    discrepancyCount: lines.filter((l) => DISCREPANT.includes(l.status)).length,
  };
}

const ACCESSOR = (row: AsnRow, key: string): unknown => (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class ReceivingService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<AsnRow>> {
    const source = db.asns.filter((a) => !scope.length || scope.includes(a.warehouseCode)).map(toRow);

    return this.api.simulate(source, { delayMs: 330 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.number, r.supplierName, r.warehouseCode],
        }),
      ),
    );
  }

  getById(id: string): Observable<AsnRow> {
    const found = db.asns.find((a) => a.id === id || a.number === id);
    return this.api.simulate(found, { delayMs: 280 }).pipe(
      map((a) => {
        if (!a) throw new ApiError('not-found', translate('svc.asnNotFound'));
        return toRow(a);
      }),
    );
  }

  getLines(id: string): Observable<ReceiptLineRow[]> {
    const asn = db.asns.find((a) => a.id === id || a.number === id);
    const nameByCode = new Map(db.skus.map((s) => [s.code, s.name]));
    const rows = asn
      ? db.receiptLines
          .filter((l) => l.asnNumber === asn.number)
          .map((l) => ({ ...l, skuName: nameByCode.get(l.skuCode) ?? l.skuCode }))
      : [];

    return this.api.simulate(rows, { delayMs: 280 });
  }

  isNumberAvailable(number: string): Observable<boolean> {
    const taken = db.asns.some((a) => a.number.toLowerCase() === number.trim().toLowerCase());
    return this.api.simulate(!taken, { delayMs: 400 });
  }

  create(draft: AsnDraft): Observable<AsnRow> {
    return this.api.simulate(draft, { delayMs: 500, kind: 'write' }).pipe(
      map((d) => {
        if (db.asns.some((a) => a.number.toLowerCase() === d.number.toLowerCase())) {
          throw new ApiError('conflict', translate('svc.asnNumberTaken', { number: d.number }));
        }
        const record: AsnRec = {
          id: `asn-${db.asns.length + 1}`,
          number: d.number.toUpperCase(),
          supplierName: d.supplierName,
          warehouseCode: d.warehouseCode,
          expectedDate: d.expectedDate,
          status: 'expected',
        };
        db.asns.unshift(record);
        return toRow(record);
      }),
    );
  }
}
