import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { AllocationRec, BalanceRec, db } from './mock-data';
import { fefoViolation, isReservable } from './stock-rules';
import { translate } from '../../../core/i18n/i18n.service';
import { MAX_STOCK_QUANTITY, SALES_ORDER_NUMBER_PATTERN } from '../../../shared/validators/wms-validators';
import { DbPersistenceService } from './db-persistence.service';

export interface ReservationRow {
  id: string;
  orderNumber: string;
  sku: string;
  lot?: string;
  locationPath: string;
  warehouseCode: string;
  quantity: number;
  requested: number;
  strategy: 'FEFO' | 'FIFO';
  isPartial: boolean;
  isBackorder: boolean;
  overrideReason?: string;
  /** Single derived label the table and the filter both use. */
  fulfilment: 'full' | 'partial' | 'backorder';
  version: number;
}

/** An alternative lot an operator may re-allocate a reservation to. */
export interface LotCandidate {
  lot?: string;
  locationPath: string;
  expiryDate?: string;
  /** Units still free after other reservations are subtracted. */
  freeQuantity: number;
  /** Set when choosing this lot would skip an earlier-expiry one (§10 FEFO). */
  fefoViolationLot: string | null;
}

export interface SalesOrderDraft {
  number: string;
  warehouseCode: string;
  priority: number;
  carrier: string;
  route: string;
  cutOffTime: string;
  skuCode: string;
  quantity: number;
}

function toRow(a: AllocationRec): ReservationRow {
  return {
    id: a.id,
    orderNumber: a.orderNumber,
    sku: a.skuCode,
    lot: a.lot,
    locationPath: a.locationPath,
    warehouseCode: a.warehouseCode,
    quantity: a.quantity,
    requested: a.requested,
    strategy: a.strategy,
    isPartial: a.isPartial,
    isBackorder: a.isBackorder,
    overrideReason: a.overrideReason,
    fulfilment: a.isBackorder ? 'backorder' : a.isPartial ? 'partial' : 'full',
    version: a.version,
  };
}

/**
 * Units of a balance that no allocation has claimed yet. `exceptId` lets the
 * allocation being edited release its own hold before we re-check the target.
 */
function freeQuantity(balance: BalanceRec, exceptId?: string): number {
  const claimed = db.allocations
    .filter(
      (a) =>
        a.id !== exceptId &&
        a.skuCode === balance.skuCode &&
        a.warehouseCode === balance.warehouseCode &&
        a.lot === balance.lot &&
        a.locationPath === balance.locationPath,
    )
    .reduce((sum, a) => sum + a.quantity, 0);

  return Math.max(0, balance.quantity - claimed);
}

/** Reservable balances of the same SKU in the same warehouse. */
function poolFor(alloc: AllocationRec): BalanceRec[] {
  return db.balances.filter(
    (b) =>
      b.skuCode === alloc.skuCode &&
      b.warehouseCode === alloc.warehouseCode &&
      isReservable(b.status),
  );
}

const ACCESSOR = (row: ReservationRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private readonly api = inject(MockApiService);
  private readonly persistence = inject(DbPersistenceService);

  query(scope: string[], query: ListQuery): Observable<ListResult<ReservationRow>> {
    const source = db.allocations
      .filter((a) => !scope.length || scope.includes(a.warehouseCode))
      .map(toRow);

    return this.api.simulate(source, { delayMs: 330 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.orderNumber, r.sku, r.lot ?? ''],
        }),
      ),
    );
  }

  totals(scope: string[]): Observable<{ total: number; partial: number; backorder: number; overrides: number }> {
    const rows = db.allocations.filter((a) => !scope.length || scope.includes(a.warehouseCode));
    return this.api.simulate(
      {
        total: rows.length,
        partial: rows.filter((r) => r.isPartial && !r.isBackorder).length,
        backorder: rows.filter((r) => r.isBackorder).length,
        overrides: rows.filter((r) => r.overrideReason).length,
      },
      { delayMs: 200 },
    );
  }

  orderOptions(): { skus: { code: string; name: string }[]; carriers: string[] } {
    return { skus: db.skus.map(({ code, name }) => ({ code, name })), carriers: [...db.carriers] };
  }

  createOrder(draft: SalesOrderDraft): Observable<ReservationRow> {
    return this.api.simulate(draft, { delayMs: 560, kind: 'write' }).pipe(
      map((value) => {
        const number = value.number.trim().toUpperCase();
        if (!SALES_ORDER_NUMBER_PATTERN.test(number)) throw new ApiError('validation', translate('svc.invalidOrderNumber'));
        if (db.orders.some((order) => order.number === number)) throw new ApiError('conflict', translate('svc.orderNumberTaken'));
        const sku = db.skus.find((item) => item.code === value.skuCode);
        if (!sku) throw new ApiError('validation', translate('svc.skuNotFound'));
        if (!Number.isInteger(value.quantity) || value.quantity <= 0 || value.quantity > MAX_STOCK_QUANTITY) throw new ApiError('validation', translate('svc.invalidExpectedQuantity'));

        const strategy: 'FEFO' | 'FIFO' = sku.lotTracked ? 'FEFO' : 'FIFO';
        const pool = db.balances
          .filter((balance) => balance.skuCode === sku.code && balance.warehouseCode === value.warehouseCode && isReservable(balance.status))
          .sort((a, b) => strategy === 'FEFO'
            ? (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999')
            : a.id.localeCompare(b.id));
        let remaining = value.quantity;
        const allocations: AllocationRec[] = [];
        for (const balance of pool) {
          const quantity = Math.min(remaining, freeQuantity(balance));
          if (quantity <= 0) continue;
          allocations.push({
            id: `al-live-${db.allocations.length + allocations.length + 1}`,
            orderNumber: number,
            skuCode: sku.code,
            lot: balance.lot,
            locationPath: balance.locationPath,
            warehouseCode: value.warehouseCode,
            quantity,
            requested: value.quantity,
            strategy,
            isPartial: false,
            isBackorder: false,
            version: 1,
          });
          remaining -= quantity;
          if (!remaining) break;
        }
        if (remaining > 0) {
          if (allocations.length) {
            allocations.forEach((allocation) => (allocation.isPartial = true));
          } else {
            allocations.push({
              id: `al-live-${db.allocations.length + 1}`,
              orderNumber: number,
              skuCode: sku.code,
              locationPath: '—',
              warehouseCode: value.warehouseCode,
              quantity: 0,
              requested: value.quantity,
              strategy,
              isPartial: true,
              isBackorder: true,
              version: 1,
            });
          }
        }
        db.orders.unshift({
          id: `ord-${db.orders.length + 1}`,
          number,
          warehouseCode: value.warehouseCode,
          priority: value.priority,
          carrier: value.carrier,
          route: value.route.trim(),
          cutOffTime: value.cutOffTime,
          status: allocations.some((allocation) => allocation.quantity > 0) ? 'allocated' : 'new',
          lines: [{ skuCode: sku.code, quantity: value.quantity }],
        });
        db.allocations.unshift(...allocations);
        return toRow(allocations[0]);
      }),
      this.persistence.afterWrite(),
    );
  }

  /** Lots this reservation could be moved to, with their free quantity and FEFO verdict. */
  candidates(id: string): Observable<LotCandidate[]> {
    const alloc = db.allocations.find((a) => a.id === id);
    if (!alloc) return this.api.simulate<LotCandidate[]>([], { delayMs: 200 });

    const pool = poolFor(alloc);
    const rows = pool
      .filter((b) => !(b.lot === alloc.lot && b.locationPath === alloc.locationPath))
      .map((b) => ({
        lot: b.lot,
        locationPath: b.locationPath,
        expiryDate: b.expiryDate,
        freeQuantity: freeQuantity(b, id),
        fefoViolationLot:
          alloc.strategy === 'FEFO'
            ? fefoViolation(b, pool.filter((c) => c !== b && freeQuantity(c, id) > 0))
            : null,
      }))
      .filter((c) => c.freeQuantity > 0)
      .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'));

    return this.api.simulate(rows, { delayMs: 260 });
  }

  /**
   * Manually re-allocates a reservation to another lot (§4 override). Two guards make
   * concurrent edits safe (§11): the row `version` catches a stale screen, and the
   * target lot's free quantity is re-checked at write time, so a lot another operator
   * consumed in the meantime raises a conflict instead of over-committing the stock.
   */
  override(
    id: string,
    expectedVersion: number,
    target: { lot?: string; locationPath: string },
    reason: string,
  ): Observable<ReservationRow> {
    return this.api.simulate(id, { delayMs: 520, kind: 'write' }).pipe(
      map(() => {
        const alloc = db.allocations.find((a) => a.id === id);
        if (!alloc) throw new ApiError('not-found', translate('svc.reservationNotFound'));

        this.api.assertVersion(expectedVersion, alloc.version);

        const balance = poolFor(alloc).find(
          (b) => b.lot === target.lot && b.locationPath === target.locationPath,
        );
        if (!balance) {
          throw new ApiError('validation', translate('svc.lotNotReservable'));
        }

        // The quantity half of §11: someone else may have taken this lot since the
        // screen loaded, so re-check against live claims rather than the cached view.
        const free = freeQuantity(balance, id);
        if (free < alloc.quantity) {
          throw new ApiError(
            'conflict',
            translate('svc.notEnoughFree', {
        target: target.lot ?? target.locationPath,
        free,
        needed: alloc.quantity,
      }),
            alloc.version,
          );
        }

        alloc.lot = balance.lot;
        alloc.locationPath = balance.locationPath;
        alloc.overrideReason = reason;
        alloc.version += 1;

        return toRow(alloc);
      }),
      this.persistence.afterWrite(),
    );
  }
}
