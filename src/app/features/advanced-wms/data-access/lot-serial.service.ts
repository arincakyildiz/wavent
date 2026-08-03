import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { StockStatus } from '../models/entities';
import { BalanceRec, db } from './mock-data';
import {
  LotHealth,
  LotRow,
  SerialIssue,
  lotRows,
  serialIntegrityIssues,
  serialIsAvailable,
} from './selectors';

export type { LotHealth, LotRow, SerialIssue };

/** What the "register a serialised unit" form submits. */
export interface SerialDraft {
  skuCode: string;
  serial: string;
  lot?: string;
  warehouseCode: string;
  locationPath: string;
  expiryDate?: string;
}

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

  /** SKUs the register-serial form may target — only serial-tracked ones qualify. */
  serialTrackedSkus(): { code: string; name: string }[] {
    return db.skus.filter((s) => s.serialTracked).map((s) => ({ code: s.code, name: s.name }));
  }

  /**
   * Registers one serialised unit.
   *
   * §10 is enforced here, not just in the form: the async validator can only tell the
   * operator what was true when they typed, so the uniqueness check is repeated at
   * write time and a serial claimed in between raises a conflict. Serial-tracked units
   * are always quantity 1 — that is the rule, not a default.
   */
  registerSerial(draft: SerialDraft): Observable<LotRow> {
    return this.api.simulate(draft, { delayMs: 520, kind: 'write' }).pipe(
      map(() => {
        const serial = draft.serial.trim();
        const sku = db.skus.find((s) => s.code === draft.skuCode);

        if (!sku) throw new ApiError('validation', 'Ürün bulunamadı.');
        if (!sku.serialTracked) {
          throw new ApiError('validation', `${sku.code} seri takipli bir ürün değil.`);
        }
        if (!serial) throw new ApiError('validation', 'Seri numarası zorunludur.');

        // Re-check against live data: the form validated an earlier snapshot.
        if (!serialIsAvailable(draft.skuCode, serial)) {
          throw new ApiError('conflict', `${serial} bu ürün için zaten kayıtlı.`);
        }

        const location = db.locations.find(
          (l) => l.warehouseCode === draft.warehouseCode && l.path === draft.locationPath,
        );
        if (!location) throw new ApiError('validation', 'Lokasyon bulunamadı.');

        const record: BalanceRec = {
          id: `bal-serial-${db.balances.length + 1}`,
          skuCode: draft.skuCode,
          lot: sku.lotTracked ? draft.lot : undefined,
          serial,
          locationPath: draft.locationPath,
          warehouseCode: draft.warehouseCode,
          quantity: 1,
          status: StockStatus.Available,
          expiryDate: draft.expiryDate,
        };
        db.balances.push(record);

        const row = lotRows([draft.warehouseCode]).find((r) => r.id === record.id);
        if (!row) throw new ApiError('validation', 'Kayıt oluşturuldu ancak okunamadı.');
        return row;
      }),
    );
  }
}
