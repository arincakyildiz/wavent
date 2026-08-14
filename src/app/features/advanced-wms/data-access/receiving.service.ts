import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { ASNStatus, ReceiptLineStatus } from '../models/entities';
import { AsnRec, ReceiptLineRec, db } from './mock-data';
import { translate } from '../../../core/i18n/i18n.service';
import { DbPersistenceService } from './db-persistence.service';
import { ASN_NUMBER_PATTERN, LOT_CODE_PATTERN, MAX_STOCK_QUANTITY } from '../../../shared/validators/wms-validators';

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
  skuCode: string;
  expectedQuantity: number;
  lot?: string;
}

export interface ReceiptInput {
  receivedQuantity: number;
  damagedQuantity: number;
  quarantine: boolean;
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
  private readonly persistence = inject(DbPersistenceService);

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

  availableSkus(): { code: string; name: string; lotTracked: boolean }[] {
    return db.skus.map(({ code, name, lotTracked }) => ({ code, name, lotTracked }));
  }

  create(draft: AsnDraft): Observable<AsnRow> {
    return this.api.simulate(draft, { delayMs: 500, kind: 'write' }).pipe(
      map((d) => {
        if (!ASN_NUMBER_PATTERN.test(d.number.trim().toUpperCase())) {
          throw new ApiError('validation', translate('svc.invalidAsnNumber'));
        }
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
          version: 1,
        };
        const sku = db.skus.find((item) => item.code === d.skuCode);
        if (!sku) throw new ApiError('validation', translate('svc.skuNotFound'));
        if (!Number.isInteger(d.expectedQuantity) || d.expectedQuantity <= 0 || d.expectedQuantity > MAX_STOCK_QUANTITY) {
          throw new ApiError('validation', translate('svc.invalidExpectedQuantity'));
        }
        if (sku.lotTracked && !d.lot?.trim()) {
          throw new ApiError('validation', translate('svc.lotRequired'));
        }
        if (d.lot?.trim() && !LOT_CODE_PATTERN.test(d.lot.trim().toUpperCase())) {
          throw new ApiError('validation', translate('svc.invalidLot'));
        }
        db.asns.unshift(record);
        db.receiptLines.unshift({
          id: `rl-${db.receiptLines.length + 1}`,
          asnNumber: record.number,
          skuCode: sku.code,
          lot: sku.lotTracked ? d.lot?.trim().toUpperCase() : undefined,
          expectedQuantity: d.expectedQuantity,
          receivedQuantity: 0,
          damagedQuantity: 0,
          status: 'pending',
          version: 1,
        });
        return toRow(record);
      }),
      this.persistence.afterWrite(),
    );
  }

  receiveLine(id: string, expectedVersion: number, input: ReceiptInput): Observable<ReceiptLineRow> {
    return this.api.simulate(id, { delayMs: 520, kind: 'write' }).pipe(
      map(() => {
        const line = db.receiptLines.find((record) => record.id === id);
        if (!line) throw new ApiError('not-found', translate('svc.receiptLineNotFound'));
        this.api.assertVersion(expectedVersion, line.version);
        if (line.status !== 'pending') {
          throw new ApiError('validation', translate('svc.receiptLineProcessed'));
        }
        if (!Number.isInteger(input.receivedQuantity) || input.receivedQuantity < 0 || input.receivedQuantity > MAX_STOCK_QUANTITY) {
          throw new ApiError('validation', translate('svc.invalidReceivedQuantity'));
        }
        if (!Number.isInteger(input.damagedQuantity) || input.damagedQuantity < 0 || input.damagedQuantity > MAX_STOCK_QUANTITY || input.damagedQuantity > input.receivedQuantity) {
          throw new ApiError('validation', translate('svc.invalidDamagedQuantity'));
        }

        line.receivedQuantity = input.receivedQuantity;
        line.damagedQuantity = input.damagedQuantity;
        line.status = input.quarantine
          ? 'quarantined'
          : input.damagedQuantity > 0
            ? 'damaged'
            : input.receivedQuantity < line.expectedQuantity
              ? 'short'
              : input.receivedQuantity > line.expectedQuantity
                ? 'over'
                : 'matched';
        line.version += 1;

        const asn = db.asns.find((record) => record.number === line.asnNumber);
        if (asn && asn.status !== 'closed') {
          const allProcessed = db.receiptLines
            .filter((record) => record.asnNumber === line.asnNumber)
            .every((record) => record.status !== 'pending');
          asn.status = allProcessed ? 'closed' : 'receiving';
          asn.version += 1;
        }

        const warehouseCode = asn?.warehouseCode ?? db.warehouses[0].code;
        const goodQuantity = input.receivedQuantity - input.damagedQuantity;
        const sku = db.skus.find((record) => record.code === line.skuCode);
        const target = db.locations.find(
          (location) => location.warehouseCode === warehouseCode && location.type === 'bin' && location.locationClass === sku?.storageClass && location.status === 'active',
        );
        if (goodQuantity > 0 && target && !db.putaway.some((record) => record.receiptLineId === line.id)) {
          db.putaway.unshift({
            id: `pw-${db.putaway.length + 1}`,
            receiptLineId: line.id,
            asnNumber: line.asnNumber,
            skuCode: line.skuCode,
            lot: line.lot,
            quantity: goodQuantity,
            warehouseCode,
            suggestedLocationPath: target.path,
            score: 95,
            reasons: ['seed.putaway.classOk', 'seed.putaway.capacityOk'],
            accepted: false,
            version: 1,
          });
        }
        if (input.damagedQuantity > 0 || input.quarantine) {
          db.exceptions.unshift({
            id: `ex-live-${db.exceptions.length + 1}`,
            type: 'damage',
            severity: input.quarantine ? 'high' : 'medium',
            warehouseCode,
            referenceType: 'ReceiptLine',
            referenceId: line.id,
            status: 'open',
            createdAt: new Date().toISOString(),
            version: 1,
          });
        }
        db.movements.unshift({
          id: `mv-live-${db.movements.length + 1}`,
          at: new Date().toISOString(),
          skuCode: line.skuCode,
          lot: line.lot,
          warehouseCode,
          quantity: input.receivedQuantity,
          toLocation: 'STAGE/IN',
          type: 'receipt',
          reasonCode: line.asnNumber,
          performedBy: 'Current user',
        });

        const skuName = db.skus.find((record) => record.code === line.skuCode)?.name ?? line.skuCode;
        return { ...line, skuName };
      }),
      this.persistence.afterWrite(),
    );
  }
}
