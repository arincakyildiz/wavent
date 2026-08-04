import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { StockStatus } from '../models/entities';
import { db } from './mock-data';
import { SkuStock, balancesInScope, skuStock, skuStockFor } from './selectors';
import { translate } from '../../../core/i18n/i18n.service';

export interface InventoryRow extends SkuStock {}

export interface InventoryLotRow {
  id: string;
  lot: string;
  serial?: string;
  locationPath: string;
  warehouseCode: string;
  quantity: number;
  status: StockStatus;
  expiryDate?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: string;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  runningBalance: number;
  reasonCode: string;
}

const ACCESSOR = (row: InventoryRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<InventoryRow>> {
    return this.api.simulate(skuStock(scope), { delayMs: 340 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.skuCode, r.name],
        }),
      ),
    );
  }

  getBySku(skuCode: string, scope: string[]): Observable<InventoryRow> {
    return this.api.simulate(skuStockFor(skuCode, scope), { delayMs: 300 }).pipe(
      map((row) => {
        if (!row) throw new ApiError('not-found', translate('svc.stockNotFound', { code: skuCode }));
        return row;
      }),
    );
  }

  getLots(skuCode: string, scope: string[]): Observable<InventoryLotRow[]> {
    const rows = balancesInScope(scope)
      .filter((b) => b.skuCode === skuCode)
      .map((b) => ({
        id: b.id,
        lot: b.lot ?? '—',
        serial: b.serial,
        locationPath: b.locationPath,
        warehouseCode: b.warehouseCode,
        quantity: b.quantity,
        status: b.status,
        expiryDate: b.expiryDate,
      }));

    return this.api.simulate(rows, { delayMs: 280 });
  }

  /**
   * Movement history with a running balance. Computed from oldest to newest so the
   * balance column reads as a real ledger, then reversed for display.
   */
  getLedger(skuCode: string, scope: string[]): Observable<LedgerEntry[]> {
    const movements = db.movements
      .filter((m) => m.skuCode === skuCode && (!scope.length || scope.includes(m.warehouseCode)))
      .slice()
      .sort((a, b) => a.at.localeCompare(b.at));

    const opening = skuStockFor(skuCode, scope)?.onHand ?? 0;
    const net = movements.reduce((s, m) => s + m.quantity, 0);
    let running = opening - net;

    const entries = movements.map((m) => {
      running += m.quantity;
      return {
        id: m.id,
        date: m.at,
        type: m.type,
        quantity: m.quantity,
        fromLocation: m.fromLocation,
        toLocation: m.toLocation,
        runningBalance: running,
        reasonCode: m.reasonCode,
      } satisfies LedgerEntry;
    });

    return this.api.simulate(entries.reverse(), { delayMs: 300 });
  }
}
