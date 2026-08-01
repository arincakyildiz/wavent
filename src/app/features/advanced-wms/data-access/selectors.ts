import { StockStatus } from '../models/entities';
import { AllocationRec, BalanceRec, LocationRec, PackageRec, db } from './mock-data';

/**
 * Single derivation layer. Every screen that needs a computed quantity, percentage or
 * rule verdict calls in here, so on-hand / available / reserved can never disagree
 * between the Inventory list, the SKU detail and the Control Tower.
 */

export interface SkuStock {
  skuCode: string;
  name: string;
  onHand: number;
  available: number;
  reserved: number;
  quarantine: number;
  damaged: number;
  blocked: number;
  lotTracked: boolean;
  serialTracked: boolean;
  nearestExpiry?: string;
  warehouseCodes: string[];
}

function sumBy(rows: BalanceRec[], status: StockStatus): number {
  return rows.reduce((sum, r) => (r.status === status ? sum + r.quantity : sum), 0);
}

/** Balances narrowed to a warehouse scope; `codes` empty means "no scope filter". */
export function balancesInScope(codes: string[]): BalanceRec[] {
  if (!codes.length) return db.balances;
  return db.balances.filter((b) => codes.includes(b.warehouseCode));
}

export function skuStock(codes: string[] = []): SkuStock[] {
  const scoped = balancesInScope(codes);
  const bySku = new Map<string, BalanceRec[]>();
  for (const b of scoped) {
    const list = bySku.get(b.skuCode);
    if (list) list.push(b);
    else bySku.set(b.skuCode, [b]);
  }

  return db.skus
    .map((sku) => {
      const rows = bySku.get(sku.code) ?? [];
      const expiries = rows.map((r) => r.expiryDate).filter((d): d is string => !!d).sort();

      return {
        skuCode: sku.code,
        name: sku.name,
        onHand: rows.reduce((s, r) => s + r.quantity, 0),
        available: sumBy(rows, StockStatus.Available),
        reserved: sumBy(rows, StockStatus.Reserved),
        quarantine: sumBy(rows, StockStatus.Quarantine),
        damaged: sumBy(rows, StockStatus.Damaged),
        blocked: sumBy(rows, StockStatus.Blocked),
        lotTracked: sku.lotTracked,
        serialTracked: sku.serialTracked,
        nearestExpiry: expiries[0],
        warehouseCodes: [...new Set(rows.map((r) => r.warehouseCode))],
      } satisfies SkuStock;
    })
    .filter((s) => s.onHand > 0);
}

export function skuStockFor(skuCode: string, codes: string[] = []): SkuStock | undefined {
  return skuStock(codes).find((s) => s.skuCode === skuCode);
}

export interface NetworkTotals {
  onHand: number;
  available: number;
  reserved: number;
  quarantine: number;
  damaged: number;
  inTransit: number;
  openExceptions: number;
}

export function networkTotals(codes: string[] = []): NetworkTotals {
  const rows = balancesInScope(codes);
  const inTransit = db.shipments
    .filter((s) => (!codes.length || codes.includes(s.warehouseCode)) && s.status === 'in-transit')
    .reduce((sum, s) => sum + s.packageCodes.length * 420, 0);

  return {
    onHand: rows.reduce((s, r) => s + r.quantity, 0),
    available: sumBy(rows, StockStatus.Available),
    reserved: sumBy(rows, StockStatus.Reserved),
    quarantine: sumBy(rows, StockStatus.Quarantine),
    damaged: sumBy(rows, StockStatus.Damaged),
    inTransit,
    openExceptions: db.exceptions.filter(
      (e) => (!codes.length || codes.includes(e.warehouseCode)) && e.status !== 'resolved',
    ).length,
  };
}

/** Inventory units per warehouse, used by the Overview map and the Warehouses list. */
export function inventoryByWarehouse(): { code: string; units: number }[] {
  return db.warehouses.map((w) => ({
    code: w.code,
    units: db.balances.filter((b) => b.warehouseCode === w.code).reduce((s, b) => s + b.quantity, 0),
  }));
}

export function locationCount(warehouseCode: string): number {
  return db.locations.filter((l) => l.warehouseCode === warehouseCode && l.type === 'bin').length;
}

export function warehouseCapacityPct(warehouseCode: string): number {
  const bins = db.locations.filter((l) => l.warehouseCode === warehouseCode && l.type === 'bin');
  if (!bins.length) return 0;
  const max = bins.reduce((s, l) => s + l.maxWeightKg, 0);
  const used = bins.reduce((s, l) => s + l.usedWeightKg, 0);
  return max ? Math.round((used / max) * 100) : 0;
}

export function locationCapacityPct(loc: LocationRec): number {
  if (!loc.maxWeightKg) return 0;
  return Math.round((loc.usedWeightKg / loc.maxWeightKg) * 100);
}

/* ------------------------------------------------------------------ *
 * Business rules — shared by UI and unit tests
 * ------------------------------------------------------------------ */

export const VARIANCE_THRESHOLD_PCT = 2;

export function variancePct(expected: number, counted: number): number {
  if (!expected) return 0;
  return Math.abs((expected - counted) / expected) * 100;
}

/** §10: a variance above the threshold forces a second count. */
export function requiresSecondCount(expected: number, counted: number, thresholdPct = VARIANCE_THRESHOLD_PCT): boolean {
  return variancePct(expected, counted) > thresholdPct;
}

/** §10: a package outside weight tolerance cannot continue without supervisor approval. */
export function withinWeightTolerance(pkg: Pick<PackageRec, 'weightKg' | 'expectedWeightKg' | 'toleranceKg'>): boolean {
  return Math.abs(pkg.weightKg - pkg.expectedWeightKg) <= pkg.toleranceKg;
}

/** §10: quarantine / damaged / blocked stock may never be reserved to an order. */
export function isReservable(status: StockStatus): boolean {
  return status === StockStatus.Available;
}

/** §10: putaway may not exceed a location's weight capacity. */
export function fitsCapacity(loc: LocationRec, addedWeightKg: number): boolean {
  return loc.usedWeightKg + addedWeightKg <= loc.maxWeightKg;
}

/**
 * §10: for shelf-life SKUs, an earlier-expiry lot must be consumed first. Returns the
 * lot that should have been picked when the choice breaks FEFO, otherwise null.
 */
export function fefoViolation(
  chosen: { lot?: string; expiryDate?: string },
  candidates: { lot?: string; expiryDate?: string }[],
): string | null {
  if (!chosen.expiryDate) return null;
  const earlier = candidates
    .filter((c) => c.expiryDate && c.expiryDate < chosen.expiryDate! && c.lot !== chosen.lot)
    .sort((a, b) => a.expiryDate!.localeCompare(b.expiryDate!))[0];
  return earlier?.lot ?? null;
}

/** §10: on-hand must equal the sum of its status buckets. */
export function stockIsBalanced(s: SkuStock): boolean {
  return s.onHand === s.available + s.reserved + s.quarantine + s.damaged + s.blocked;
}

/* ------------------------------------------------------------------ *
 * Order / wave derivations
 * ------------------------------------------------------------------ */

export function allocationsForOrder(orderNumber: string): AllocationRec[] {
  return db.allocations.filter((a) => a.orderNumber === orderNumber);
}

export interface WaveOrderStatus {
  orderNumber: string;
  priority: number;
  route: string;
  lineCount: number;
  status: 'ok' | 'capacity-risk' | 'stock-shortage';
  reason?: string;
}

/**
 * Per-order publish verdict for a wave. Shortages come from the allocation engine, so
 * the risk shown on the detail screen reflects the same data as Reservations.
 */
export function waveOrderStatuses(waveId: string): WaveOrderStatus[] {
  const wave = db.waves.find((w) => w.id === waveId);
  if (!wave) return [];

  return wave.orderNumbers.map((number) => {
    const order = db.orders.find((o) => o.number === number);
    const allocs = allocationsForOrder(number);
    const shortage = allocs.some((a) => a.isBackorder || a.isPartial);

    let status: WaveOrderStatus['status'] = 'ok';
    let reason: string | undefined;

    if (shortage) {
      const missing = allocs.find((a) => a.isBackorder) ?? allocs.find((a) => a.isPartial);
      status = 'stock-shortage';
      reason = `${missing?.skuCode ?? 'SKU'} için yeterli stok yok`;
    } else if (wave.capacityUsedPct >= 85) {
      status = 'capacity-risk';
      reason = `Vardiya kapasitesi %${wave.capacityUsedPct} dolulukta`;
    }

    return {
      orderNumber: number,
      priority: order?.priority ?? 3,
      route: order?.route ?? '—',
      lineCount: order?.lines.length ?? 0,
      status,
      reason,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Lot / serial + traceability
 * ------------------------------------------------------------------ */

export type LotHealth = 'ok' | 'expiring' | 'blocked' | 'recalled';

export interface LotRow {
  id: string;
  lot: string;
  serial?: string;
  skuCode: string;
  skuName: string;
  warehouseCode: string;
  locationPath: string;
  quantity: number;
  expiryDate?: string;
  daysToExpiry?: number;
  health: LotHealth;
}

const EXPIRING_WINDOW_DAYS = 15;

export function lotRows(codes: string[] = []): LotRow[] {
  const today = new Date('2026-07-30T00:00:00');
  const nameByCode = new Map(db.skus.map((s) => [s.code, s.name]));

  return balancesInScope(codes)
    .filter((b) => b.lot || b.serial)
    .map((b) => {
      const days = b.expiryDate
        ? Math.round((new Date(b.expiryDate).getTime() - today.getTime()) / 86_400_000)
        : undefined;

      let health: LotHealth = 'ok';
      if (b.status === StockStatus.Blocked) health = 'blocked';
      else if (days !== undefined && days < 0) health = 'recalled';
      else if (days !== undefined && days <= EXPIRING_WINDOW_DAYS) health = 'expiring';

      return {
        id: b.id,
        lot: b.lot ?? '—',
        serial: b.serial,
        skuCode: b.skuCode,
        skuName: nameByCode.get(b.skuCode) ?? b.skuCode,
        warehouseCode: b.warehouseCode,
        locationPath: b.locationPath,
        quantity: b.quantity,
        expiryDate: b.expiryDate,
        daysToExpiry: days,
        health,
      } satisfies LotRow;
    });
}

export interface TraceEvent {
  id: string;
  at: string;
  stage: 'Receipt' | 'Putaway' | 'Reservation' | 'Pick' | 'Pack' | 'Shipment';
  description: string;
  referenceId: string;
  actor: string;
}

/** Traceable lots are those that appear in a receipt line — i.e. entered the building. */
export function traceableLots(): string[] {
  return [...new Set(db.receiptLines.map((l) => l.lot).filter((l): l is string => !!l))].sort();
}

/**
 * Walks a lot from receipt to shipment by joining the records that reference it,
 * so the timeline is assembled from real data rather than a hand-written script.
 */
export function traceLot(lot: string): TraceEvent[] {
  const events: TraceEvent[] = [];
  let n = 0;
  const push = (e: Omit<TraceEvent, 'id'>) => events.push({ ...e, id: `tr-${++n}` });

  const line = db.receiptLines.find((l) => l.lot === lot);
  if (!line) return [];

  const receiptMovement = db.movements.find((m) => m.lot === lot && m.type === 'receipt');
  push({
    at: receiptMovement?.at ?? '—',
    stage: 'Receipt',
    description: `${line.asnNumber} üzerinden ${line.receivedQuantity} adet kabul edildi`,
    referenceId: line.asnNumber,
    actor: receiptMovement?.performedBy ?? 'System',
  });

  const pw = db.putaway.find((p) => p.lot === lot && p.accepted);
  if (pw) {
    const mv = db.movements.find((m) => m.lot === lot && m.type === 'putaway');
    push({
      at: mv?.at ?? '—',
      stage: 'Putaway',
      description: `${pw.suggestedLocationPath} lokasyonuna yerleştirildi (skor ${pw.score})`,
      referenceId: pw.id.toUpperCase(),
      actor: 'System',
    });
  }

  for (const alloc of db.allocations.filter((a) => a.lot === lot && a.quantity > 0).slice(0, 2)) {
    push({
      at: '—',
      stage: 'Reservation',
      description: `${alloc.orderNumber} için ${alloc.quantity} adet ${alloc.strategy} ile rezerve edildi`,
      referenceId: alloc.orderNumber,
      actor: 'System',
    });

    const wave = db.waves.find((w) => w.orderNumbers.includes(alloc.orderNumber));
    const task = wave ? db.pickTasks.find((t) => t.waveName === wave.name) : undefined;
    if (task) {
      const mv = db.movements.find((m) => m.reasonCode === task.code);
      push({
        at: mv?.at ?? '—',
        stage: 'Pick',
        description: `${task.code} görevinde toplandı`,
        referenceId: task.code,
        actor: task.assignedTo ?? 'System',
      });
    }

    const pkg = db.packages.find((p) => p.orderNumber === alloc.orderNumber);
    if (pkg) {
      push({
        at: '—',
        stage: 'Pack',
        description: `Paket içerik doğrulaması ${pkg.contentVerified ? 'tamamlandı' : 'bekliyor'} (${pkg.weightKg} kg)`,
        referenceId: pkg.code,
        actor: 'System',
      });

      const shipment = db.shipments.find((s) => s.packageCodes.includes(pkg.code));
      if (shipment) {
        push({
          at: shipment.closedAt ?? '—',
          stage: 'Shipment',
          description: `${shipment.code} ile ${shipment.carrier} üzerinden sevk edildi`,
          referenceId: shipment.code,
          actor: 'System',
        });
      }
    }
  }

  return events;
}
