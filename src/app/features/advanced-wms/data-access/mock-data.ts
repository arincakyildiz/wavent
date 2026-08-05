import {
  ASNStatus,
  CycleCountStatus,
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionType,
  LocationClass,
  LocationStatus,
  PackageStatus,
  PickTaskStatus,
  PickTaskType,
  ReceiptLineStatus,
  SalesOrderStatus,
  ShipmentStatus,
  StockStatus,
  WaveStatus,
} from '../models/entities';
import { CLASS_TEMPERATURE_C, fefoViolation, isReservable } from './stock-rules';

/**
 * Single source of demo data. Everything downstream (services, selectors, screens)
 * reads from here, so quantities, references and counts agree across modules
 * instead of each screen inventing its own numbers.
 *
 * The generator is seeded, so the dataset is identical on every reload — which also
 * makes it usable as test fixtures.
 */

/* ------------------------------------------------------------------ *
 * Deterministic RNG
 * ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20240520);

const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
const int = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));
const chance = (p: number): boolean => rand() < p;

const BASE_DATE = new Date('2026-07-30T10:25:00');

function shiftDays(days: number): Date {
  const d = new Date(BASE_DATE);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function stamp(date: Date): string {
  return `${isoDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ *
 * Record shapes
 * ------------------------------------------------------------------ */

export interface WarehouseRec {
  id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  lon: number;
  lat: number;
  timezone: string;
  open: string;
  close: string;
  isActive: boolean;
  version: number;
}

export interface LocationRec {
  id: string;
  path: string;
  warehouseCode: string;
  type: 'zone' | 'aisle' | 'rack' | 'bin' | 'staging';
  locationClass: LocationClass;
  status: LocationStatus;
  maxWeightKg: number;
  maxVolumeM3: number;
  usedWeightKg: number;
  usedVolumeM3: number;
  /** Present only on temperature-controlled bins; drives the §4 putaway check. */
  temperatureRangeC?: { min: number; max: number };
}

export interface SkuRec {
  id: string;
  code: string;
  name: string;
  uom: string;
  weightKg: number;
  volumeM3: number;
  lotTracked: boolean;
  serialTracked: boolean;
  storageClass: LocationClass;
  shelfLifeDays?: number;
}

export interface BalanceRec {
  id: string;
  skuCode: string;
  lot?: string;
  serial?: string;
  locationPath: string;
  warehouseCode: string;
  quantity: number;
  status: StockStatus;
  expiryDate?: string;
}

export interface OrderRec {
  id: string;
  number: string;
  warehouseCode: string;
  priority: number;
  carrier: string;
  route: string;
  cutOffTime: string;
  status: SalesOrderStatus;
  lines: { skuCode: string; quantity: number }[];
}

export interface AllocationRec {
  id: string;
  orderNumber: string;
  skuCode: string;
  lot?: string;
  locationPath: string;
  warehouseCode: string;
  quantity: number;
  requested: number;
  strategy: 'FEFO' | 'FIFO';
  isPartial: boolean;
  isBackorder: boolean;
  overrideReason?: string;
  /** Optimistic-concurrency token — two operators re-allocating the same line conflict (§11). */
  version: number;
}

export interface WaveRec {
  id: string;
  name: string;
  warehouseCode: string;
  zone?: string;
  carrier: string;
  cutOffTime: string;
  orderNumbers: string[];
  capacityUsedPct: number;
  status: WaveStatus;
  version: number;
}

export interface PickTaskRec {
  id: string;
  code: string;
  waveName: string;
  warehouseCode: string;
  type: PickTaskType;
  assignedTo?: string;
  route: string[];
  lineCount: number;
  pickedLines: number;
  status: PickTaskStatus;
  exceptionReason?: string;
}

export interface PackageRec {
  id: string;
  code: string;
  orderNumber: string;
  warehouseCode: string;
  itemCount: number;
  weightKg: number;
  expectedWeightKg: number;
  toleranceKg: number;
  contentVerified: boolean;
  status: PackageStatus;
  version: number;
}

export interface ShipmentRec {
  id: string;
  code: string;
  warehouseCode: string;
  carrier: string;
  door: string;
  packageCodes: string[];
  status: ShipmentStatus;
  progressPct: number;
  closedAt?: string;
}

export interface AsnRec {
  id: string;
  number: string;
  supplierName: string;
  warehouseCode: string;
  expectedDate: string;
  status: ASNStatus;
}

export interface ReceiptLineRec {
  id: string;
  asnNumber: string;
  skuCode: string;
  lot?: string;
  expectedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  status: ReceiptLineStatus;
}

export interface PutawayRec {
  id: string;
  asnNumber: string;
  skuCode: string;
  lot?: string;
  quantity: number;
  warehouseCode: string;
  suggestedLocationPath: string;
  score: number;
  reasons: string[];
  accepted: boolean;
  version: number;
}

export interface CycleCountRec {
  id: string;
  code: string;
  warehouseCode: string;
  scopeLabel: string;
  expectedQuantity: number;
  countedQuantity: number;
  status: CycleCountStatus;
}

export interface ExceptionRec {
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  warehouseCode: string;
  referenceType: string;
  referenceId: string;
  owner?: string;
  status: ExceptionStatus;
  createdAt: string;
  resolutionNote?: string;
  version: number;
}

export interface MovementRec {
  id: string;
  at: string;
  skuCode: string;
  lot?: string;
  warehouseCode: string;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  type: 'receipt' | 'putaway' | 'pick' | 'adjustment' | 'cycle-count' | 'shipment';
  reasonCode: string;
  performedBy: string;
}

export interface AuditRec {
  id: string;
  at: string;
  actor: string;
  actionType: string;
  targetType: string;
  targetId: string;
  oldValue?: string;
  newValue?: string;
}

/* ------------------------------------------------------------------ *
 * Seed constants
 * ------------------------------------------------------------------ */

const OPERATORS = ['John Doe', 'Sarah Lee', 'Michael Brown', 'Jessica Park', 'David Wu', 'Elif Kaya'];
const CARRIERS = ['DHL Express', 'UPS', 'FedEx', 'Maersk', 'Aramex'];
const SUPPLIERS = [
  'FreshFarm Co.',
  'Global Bottling Ltd.',
  'ScanTech Devices',
  'Nordic Frozen Foods',
  'CleanCare Supplies',
  'PackRight Materials',
  'VoltCell Energy',
];

const WAREHOUSES: WarehouseRec[] = [
  { id: 'wh-1', code: 'NYC-01', name: 'New York DC', city: 'New York', country: 'USA', lon: -74, lat: 40.7, timezone: 'America/New_York', open: '06:00', close: '22:00', isActive: true, version: 1 },
  { id: 'wh-2', code: 'AMS-01', name: 'Amsterdam Hub', city: 'Amsterdam', country: 'Netherlands', lon: 4.9, lat: 52.4, timezone: 'Europe/Amsterdam', open: '05:00', close: '21:00', isActive: true, version: 1 },
  { id: 'wh-3', code: 'IST-01', name: 'Istanbul Merkez', city: 'Istanbul', country: 'Turkey', lon: 29, lat: 41, timezone: 'Europe/Istanbul', open: '06:00', close: '23:00', isActive: true, version: 1 },
  { id: 'wh-4', code: 'DXB-01', name: 'Dubai Logistics Park', city: 'Dubai', country: 'UAE', lon: 55.3, lat: 25.3, timezone: 'Asia/Dubai', open: '00:00', close: '23:59', isActive: true, version: 1 },
  { id: 'wh-5', code: 'GRU-01', name: 'Sao Paulo Cross-dock', city: 'Sao Paulo', country: 'Brazil', lon: -46.6, lat: -23.5, timezone: 'America/Sao_Paulo', open: '07:00', close: '19:00', isActive: false, version: 1 },
];

const PRODUCTS: { name: string; cls: LocationClass; lot: boolean; serial: boolean; shelf?: number }[] = [
  { name: 'Organic Almond Milk 1L', cls: 'chilled', lot: true, serial: false, shelf: 90 },
  { name: 'Stainless Steel Water Bottle', cls: 'ambient', lot: false, serial: false },
  { name: 'Wireless Barcode Scanner', cls: 'ambient', lot: false, serial: true },
  { name: 'Frozen Chicken Breast 5kg', cls: 'frozen', lot: true, serial: false, shelf: 180 },
  { name: 'Industrial Shelving Unit', cls: 'ambient', lot: false, serial: true },
  { name: 'Hand Sanitizer 500ml', cls: 'ambient', lot: true, serial: false, shelf: 540 },
  { name: 'Corrugated Shipping Box M', cls: 'ambient', lot: false, serial: false },
  { name: 'Lithium Battery Pack 10Ah', cls: 'hazmat', lot: true, serial: true, shelf: 720 },
  { name: 'Greek Yogurt 4x150g', cls: 'chilled', lot: true, serial: false, shelf: 30 },
  { name: 'Frozen Berry Mix 1kg', cls: 'frozen', lot: true, serial: false, shelf: 365 },
  { name: 'Thermal Label Roll', cls: 'ambient', lot: false, serial: false },
  { name: 'Pallet Wrap Film', cls: 'ambient', lot: false, serial: false },
  { name: 'Disinfectant Concentrate 5L', cls: 'hazmat', lot: true, serial: false, shelf: 400 },
  { name: 'Handheld RF Terminal', cls: 'ambient', lot: false, serial: true },
  { name: 'Cold Chain Data Logger', cls: 'chilled', lot: false, serial: true },
  { name: 'Espresso Beans 1kg', cls: 'ambient', lot: true, serial: false, shelf: 240 },
  { name: 'Olive Oil 5L Tin', cls: 'ambient', lot: true, serial: false, shelf: 500 },
  { name: 'Frozen Pizza Dough 20pc', cls: 'frozen', lot: true, serial: false, shelf: 200 },
  { name: 'Nitrile Gloves L (100)', cls: 'ambient', lot: true, serial: false, shelf: 900 },
  { name: 'Forklift Battery Charger', cls: 'hazmat', lot: false, serial: true },
];

/* ------------------------------------------------------------------ *
 * Builders
 * ------------------------------------------------------------------ */

function buildSkus(): SkuRec[] {
  return PRODUCTS.map((p, i) => ({
    id: `sku-${i + 1}`,
    code: `SKU-${1001 + i}`,
    name: p.name,
    uom: 'EA',
    weightKg: Math.round((0.2 + rand() * 12) * 100) / 100,
    volumeM3: Math.round((0.001 + rand() * 0.08) * 1000) / 1000,
    lotTracked: p.lot,
    serialTracked: p.serial,
    storageClass: p.cls,
    shelfLifeDays: p.shelf,
  }));
}

const CLASS_BY_ZONE: Record<string, LocationClass> = {
  A: 'ambient',
  B: 'ambient',
  C: 'chilled',
  F: 'frozen',
  HZ: 'hazmat',
};

function buildLocations(): LocationRec[] {
  const out: LocationRec[] = [];
  let n = 0;

  for (const wh of WAREHOUSES) {
    const zones = wh.code === 'GRU-01' ? ['A'] : ['A', 'B', 'C', 'F', 'HZ'];
    for (const zone of zones) {
      out.push({
        id: `loc-${++n}`,
        path: `${zone}`,
        warehouseCode: wh.code,
        type: 'zone',
        locationClass: CLASS_BY_ZONE[zone],
        status: 'active',
        maxWeightKg: 0,
        maxVolumeM3: 0,
        usedWeightKg: 0,
        usedVolumeM3: 0,
      });

      const aisles = zone === 'HZ' ? 1 : wh.code === 'GRU-01' ? 2 : 3;
      for (let a = 1; a <= aisles; a++) {
        const bins = zone === 'HZ' ? 2 : 4;
        for (let b = 1; b <= bins; b++) {
          const maxWeight = zone === 'HZ' ? 200 : zone === 'C' || zone === 'F' ? 400 : 500;
          const maxVolume = zone === 'HZ' ? 1.5 : zone === 'C' || zone === 'F' ? 3 : 4;
          const fill = rand();
          out.push({
            id: `loc-${++n}`,
            path: `${zone}/${String(a).padStart(2, '0')}/${String(b).padStart(2, '0')}`,
            warehouseCode: wh.code,
            type: 'bin',
            locationClass: CLASS_BY_ZONE[zone],
            status: fill > 0.96 ? 'full' : chance(0.04) ? 'blocked' : 'active',
            maxWeightKg: maxWeight,
            maxVolumeM3: maxVolume,
            usedWeightKg: Math.round(maxWeight * fill),
            usedVolumeM3: Math.round(maxVolume * fill * 10) / 10,
            temperatureRangeC: CLASS_TEMPERATURE_C[CLASS_BY_ZONE[zone]] ?? undefined,
          });
        }
      }
    }

    out.push({
      id: `loc-${++n}`,
      path: 'STAGE/OUT',
      warehouseCode: wh.code,
      type: 'staging',
      locationClass: 'ambient',
      status: 'active',
      maxWeightKg: 2000,
      maxVolumeM3: 20,
      usedWeightKg: int(200, 1400),
      usedVolumeM3: int(2, 16),
    });
  }

  return out;
}

function lotCodeFor(index: number): string {
  return `L-24${String(50 + index).padStart(3, '0')}`;
}

function buildBalances(skus: SkuRec[], locations: LocationRec[]): BalanceRec[] {
  const out: BalanceRec[] = [];
  let n = 0;
  let lotSeq = 0;
  let serialSeq = 88000;

  const bins = locations.filter((l) => l.type === 'bin' && l.status !== 'blocked');

  for (const sku of skus) {
    // Spread each SKU across a handful of warehouses so scope filtering is meaningful.
    const activeWarehouses = WAREHOUSES.filter((w) => w.isActive);
    const houses = activeWarehouses.filter(() => chance(0.7));
    const chosen = houses.length ? houses : [activeWarehouses[0]];

    for (const wh of chosen) {
      const candidates = bins.filter(
        (l) => l.warehouseCode === wh.code && l.locationClass === sku.storageClass,
      );
      if (!candidates.length) continue;

      const lotsPerWarehouse = sku.lotTracked ? int(1, 3) : 1;
      for (let i = 0; i < lotsPerWarehouse; i++) {
        const loc = pick(candidates);
        const lot = sku.lotTracked ? lotCodeFor(lotSeq++) : undefined;
        const expiry = sku.shelfLifeDays
          ? isoDate(shiftDays(int(-12, Math.min(sku.shelfLifeDays, 400))))
          : undefined;

        if (sku.serialTracked) {
          // Serial-tracked stock is one unit per record, by definition.
          const units = int(2, 5);
          for (let u = 0; u < units; u++) {
            out.push({
              id: `bal-${++n}`,
              skuCode: sku.code,
              lot,
              serial: `SN-${serialSeq++}`,
              locationPath: loc.path,
              warehouseCode: wh.code,
              quantity: 1,
              status: chance(0.12) ? pick([StockStatus.Reserved, StockStatus.Blocked]) : StockStatus.Available,
              expiryDate: expiry,
            });
          }
          continue;
        }

        const total = int(200, 4200);
        const reserved = Math.round(total * (0.1 + rand() * 0.3));
        const quarantine = chance(0.18) ? int(20, 300) : 0;
        const damaged = chance(0.15) ? int(10, 150) : 0;
        const available = Math.max(0, total - reserved - quarantine - damaged);

        const parts: [StockStatus, number][] = [
          [StockStatus.Available, available],
          [StockStatus.Reserved, reserved],
          [StockStatus.Quarantine, quarantine],
          [StockStatus.Damaged, damaged],
        ];

        for (const [status, qty] of parts) {
          if (qty <= 0) continue;
          out.push({
            id: `bal-${++n}`,
            skuCode: sku.code,
            lot,
            locationPath: loc.path,
            warehouseCode: wh.code,
            quantity: qty,
            status,
            expiryDate: expiry,
          });
        }
      }
    }
  }

  return out;
}

function buildOrders(skus: SkuRec[]): OrderRec[] {
  const out: OrderRec[] = [];
  const active = WAREHOUSES.filter((w) => w.isActive);

  for (let i = 0; i < 160; i++) {
    const wh = pick(active);
    const lineCount = int(1, 6);
    const lines: OrderRec['lines'] = [];
    for (let l = 0; l < lineCount; l++) {
      const sku = pick(skus);
      if (lines.some((x) => x.skuCode === sku.code)) continue;
      lines.push({ skuCode: sku.code, quantity: int(10, 900) });
    }

    out.push({
      id: `so-${i + 1}`,
      number: `SO-${10501 + i}`,
      warehouseCode: wh.code,
      priority: int(1, 3),
      carrier: pick(CARRIERS),
      route: `${wh.code.slice(0, 3)}-R${String(int(1, 12)).padStart(2, '0')}`,
      cutOffTime: pick(['10:00', '12:00', '14:00', '16:00', '18:00', '20:00']),
      status: 'new',
      lines,
    });
  }

  return out;
}

/**
 * Allocation engine: consumes available balances honouring FEFO for shelf-life SKUs
 * and FIFO otherwise. Produces partial allocations and backorders when stock runs
 * short — which is what makes the Reservations screen's numbers real.
 */
function buildAllocations(
  orders: OrderRec[],
  balances: BalanceRec[],
  skus: SkuRec[],
): { allocations: AllocationRec[]; allocatedOrders: Set<string> } {
  const skuByCode = new Map(skus.map((s) => [s.code, s]));
  const pool = balances
    .filter((b) => isReservable(b.status))
    .map((b) => ({ ...b, remaining: b.quantity }));

  const allocations: AllocationRec[] = [];
  const allocatedOrders = new Set<string>();
  let n = 0;

  for (const order of orders) {
    let anyAllocated = false;

    for (const line of order.lines) {
      const sku = skuByCode.get(line.skuCode)!;
      const strategy: 'FEFO' | 'FIFO' = sku.shelfLifeDays ? 'FEFO' : 'FIFO';

      const candidates = pool
        .filter(
          (b) => b.skuCode === line.skuCode && b.warehouseCode === order.warehouseCode && b.remaining > 0,
        )
        .sort((a, b) => {
          if (strategy === 'FEFO') {
            return (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999');
          }
          return a.id.localeCompare(b.id);
        });

      // A small share of FEFO picks deliberately skip the earliest lot, which is
      // exactly the override the business rules require a reason for — fefoViolation
      // then detects it the same way the Traceability screen would.
      let pickOrder = candidates;
      if (strategy === 'FEFO' && candidates.length > 1 && chance(0.08)) {
        pickOrder = [candidates[1], candidates[0], ...candidates.slice(2)];
      }

      let need = line.quantity;
      let taken = 0;

      for (const candidate of pickOrder) {
        if (need <= 0) break;
        const qty = Math.min(need, candidate.remaining);
        candidate.remaining -= qty;
        need -= qty;
        taken += qty;

        const violatedLot =
          strategy === 'FEFO'
            ? fefoViolation(
                candidate,
                candidates.filter((c) => c !== candidate && c.remaining > 0),
              )
            : null;

        allocations.push({
          id: `al-${++n}`,
          orderNumber: order.number,
          skuCode: line.skuCode,
          lot: candidate.lot,
          locationPath: candidate.locationPath,
          warehouseCode: candidate.warehouseCode,
          quantity: qty,
          requested: line.quantity,
          strategy,
          isPartial: false,
          isBackorder: false,
          overrideReason: violatedLot ? 'seed.override.newerLot' : undefined,
          version: 1,
        });
      }

      if (taken === 0) {
        allocations.push({
          id: `al-${++n}`,
          orderNumber: order.number,
          skuCode: line.skuCode,
          locationPath: '—',
          warehouseCode: order.warehouseCode,
          quantity: 0,
          requested: line.quantity,
          strategy,
          isPartial: true,
          isBackorder: true,
          version: 1,
        });
      } else {
        anyAllocated = true;
        if (taken < line.quantity) {
          // Mark every allocation for this line as partial so the UI can flag it.
          for (const a of allocations) {
            if (a.orderNumber === order.number && a.skuCode === line.skuCode) a.isPartial = true;
          }
        }
      }
    }

    if (anyAllocated) {
      allocatedOrders.add(order.number);
      order.status = 'allocated';
    }
  }

  return { allocations, allocatedOrders };
}

function buildWaves(orders: OrderRec[], allocatedOrders: Set<string>): WaveRec[] {
  const out: WaveRec[] = [];
  const eligible = orders.filter((o) => allocatedOrders.has(o.number));
  const statuses: WaveStatus[] = ['completed', 'completed', 'released', 'released', 'released', 'planned', 'planned', 'draft'];

  let cursor = 0;
  let waveNo = 240;

  for (let i = 0; i < 14 && cursor < eligible.length; i++) {
    const size = int(4, 12);
    const slice = eligible.slice(cursor, cursor + size);
    cursor += size;
    if (!slice.length) break;

    const wh = slice[0].warehouseCode;
    const inWarehouse = slice.filter((o) => o.warehouseCode === wh);
    if (!inWarehouse.length) continue;

    const status = statuses[i % statuses.length];
    // orderNumbers is the single source for the count shown in both list and detail.
    const orderNumbers = inWarehouse.map((o) => o.number);

    for (const o of inWarehouse) {
      o.status = status === 'completed' ? 'shipped' : status === 'released' ? 'picking' : 'waved';
    }

    out.push({
      id: `wv-${i + 1}`,
      name: `Wave #${++waveNo}`,
      warehouseCode: wh,
      zone: chance(0.7) ? pick(['A', 'B', 'C']) : undefined,
      carrier: inWarehouse[0].carrier,
      cutOffTime: inWarehouse[0].cutOffTime,
      orderNumbers,
      capacityUsedPct: int(35, 100),
      status,
      version: 1,
    });
  }

  return out;
}

function buildPickTasks(waves: WaveRec[], orders: OrderRec[], locations: LocationRec[]): PickTaskRec[] {
  const out: PickTaskRec[] = [];
  const byNumber = new Map(orders.map((o) => [o.number, o]));
  let n = 0;

  for (const wave of waves) {
    if (wave.status === 'draft' || wave.status === 'planned') continue;

    const bins = locations.filter((l) => l.warehouseCode === wave.warehouseCode && l.type === 'bin');
    const groups = Math.max(1, Math.ceil(wave.orderNumbers.length / int(2, 4)));

    for (let g = 0; g < groups; g++) {
      const slice = wave.orderNumbers.slice(g * 3, g * 3 + 3);
      if (!slice.length) continue;

      const lineCount = slice.reduce((sum, num) => sum + (byNumber.get(num)?.lines.length ?? 0), 0);
      const complete = wave.status === 'completed';
      const isException = !complete && chance(0.22);
      const picked = complete ? lineCount : isException ? int(0, lineCount - 1) : int(0, lineCount);

      out.push({
        id: `pt-${++n}`,
        code: `PK-${2700 + n}`,
        waveName: wave.name,
        warehouseCode: wave.warehouseCode,
        type: slice.length > 2 ? 'batch' : wave.zone ? 'zone' : 'single',
        assignedTo: complete || chance(0.85) ? pick(OPERATORS) : undefined,
        route: bins.slice(g * 2, g * 2 + int(2, 6)).map((l) => l.path),
        lineCount,
        pickedLines: Math.min(picked, lineCount),
        status: complete
          ? 'completed'
          : isException
            ? 'exception'
            : picked === 0
              ? 'pending'
              : 'in-progress',
        exceptionReason: isException
          ? pick([
              'seed.exception.wrongBarcode',
              'seed.exception.shortPick',
              'seed.exception.damaged',
              'seed.exception.emptyLocation',
            ])
          : undefined,
      });
    }
  }

  return out;
}

function buildPackages(waves: WaveRec[], orders: OrderRec[], skus: SkuRec[]): PackageRec[] {
  const out: PackageRec[] = [];
  const byNumber = new Map(orders.map((o) => [o.number, o]));
  const skuByCode = new Map(skus.map((s) => [s.code, s]));
  let n = 0;

  for (const wave of waves) {
    if (wave.status !== 'released' && wave.status !== 'completed') continue;

    for (const number of wave.orderNumbers) {
      const order = byNumber.get(number);
      if (!order) continue;
      if (wave.status === 'released' && !chance(0.6)) continue;

      const itemCount = order.lines.reduce((s, l) => s + l.quantity, 0);
      const expected =
        Math.round(
          order.lines.reduce((s, l) => s + (skuByCode.get(l.skuCode)?.weightKg ?? 1) * Math.min(l.quantity, 12), 0) *
            10,
        ) / 10;
      const tolerance = Math.max(0.2, Math.round(expected * 0.04 * 100) / 100);
      const drift = (rand() - 0.5) * tolerance * 4;
      const actual = Math.round((expected + drift) * 10) / 10;
      const withinTolerance = Math.abs(actual - expected) <= tolerance;

      out.push({
        id: `pk-${++n}`,
        code: `PKG-${4500 + n}`,
        orderNumber: number,
        warehouseCode: wave.warehouseCode,
        itemCount,
        weightKg: actual,
        expectedWeightKg: expected,
        toleranceKg: tolerance,
        contentVerified: chance(0.8),
        status: !withinTolerance
          ? 'weight-hold'
          : wave.status === 'completed'
            ? 'shipped'
            : chance(0.5)
              ? 'sealed'
              : 'open',
        version: 1,
      });
    }
  }

  return out;
}

function buildShipments(packages: PackageRec[]): ShipmentRec[] {
  const out: ShipmentRec[] = [];
  const shippable = packages.filter((p) => p.status === 'sealed' || p.status === 'shipped');
  let n = 0;

  for (let i = 0; i < shippable.length; i += int(2, 5)) {
    const group = shippable.slice(i, i + 4);
    if (!group.length) break;

    const allShipped = group.every((p) => p.status === 'shipped');
    const status: ShipmentStatus = allShipped
      ? pick<ShipmentStatus>(['delivered', 'in-transit'])
      : pick<ShipmentStatus>(['staged', 'loading', 'in-transit', 'exception']);

    const progress =
      status === 'delivered' ? 100 : status === 'loading' ? 100 : status === 'staged' ? int(10, 40) : int(45, 90);

    out.push({
      id: `sh-${++n}`,
      code: `SHP-${7800 + n}`,
      warehouseCode: group[0].warehouseCode,
      carrier: pick(CARRIERS),
      door: `D-${String(int(1, 6)).padStart(2, '0')}`,
      packageCodes: group.map((p) => p.code),
      status,
      progressPct: progress,
      closedAt: status === 'delivered' ? stamp(shiftDays(-int(1, 3))) : undefined,
    });
  }

  return out;
}

function buildAsns(skus: SkuRec[]): { asns: AsnRec[]; lines: ReceiptLineRec[]; putaway: PutawayRec[] } {
  const asns: AsnRec[] = [];
  const lines: ReceiptLineRec[] = [];
  const putaway: PutawayRec[] = [];
  const active = WAREHOUSES.filter((w) => w.isActive);
  let lineNo = 0;
  let pwNo = 0;
  let lotSeq = 400;

  for (let i = 0; i < 30; i++) {
    const wh = pick(active);
    const status = pick<ASNStatus>(['expected', 'arrived', 'receiving', 'closed', 'closed', 'cancelled']);
    const number = `ASN-${4860 + i}`;

    asns.push({
      id: `asn-${i + 1}`,
      number,
      supplierName: pick(SUPPLIERS),
      warehouseCode: wh.code,
      expectedDate: isoDate(shiftDays(int(-6, 6))),
      status,
    });

    if (status === 'cancelled' || status === 'expected') continue;

    const lineCount = int(1, 5);
    for (let l = 0; l < lineCount; l++) {
      const sku = pick(skus);
      const expected = int(100, 3200);
      const damaged = chance(0.18) ? int(10, 90) : 0;
      const received = status === 'closed' ? expected - (chance(0.25) ? int(20, 200) : 0) : chance(0.4) ? 0 : int(0, expected);
      const lineStatus: ReceiptLineStatus =
        received === 0
          ? chance(0.4)
            ? 'quarantined'
            : 'pending'
          : received === expected
            ? 'matched'
            : received > expected
              ? 'over'
              : damaged > 0
                ? 'damaged'
                : 'short';

      const lot = sku.lotTracked ? `L-24${lotSeq++}` : undefined;
      lines.push({
        id: `rl-${++lineNo}`,
        asnNumber: number,
        skuCode: sku.code,
        lot,
        expectedQuantity: expected,
        receivedQuantity: received,
        damagedQuantity: damaged,
        status: lineStatus,
      });

      if (received > 0) {
        const score = int(58, 99);
        putaway.push({
          id: `pw-${++pwNo}`,
          asnNumber: number,
          skuCode: sku.code,
          lot,
          quantity: received - damaged,
          warehouseCode: wh.code,
          suggestedLocationPath: `${sku.storageClass === 'hazmat' ? 'HZ' : sku.storageClass === 'frozen' ? 'F' : sku.storageClass === 'chilled' ? 'C' : 'A'}/${String(int(1, 3)).padStart(2, '0')}/${String(int(1, 4)).padStart(2, '0')}`,
          score,
          reasons: [
            'seed.putaway.classOk',
            score > 85 ? 'seed.putaway.capacityOk' : 'seed.putaway.capacityTight',
            sku.shelfLifeDays ? 'seed.putaway.fefoOk' : 'seed.putaway.accessibility',
          ],
          accepted: status === 'closed' && chance(0.7),
          version: 1,
        });
      }
    }
  }

  return { asns, lines, putaway };
}

function buildCycleCounts(locations: LocationRec[], skus: SkuRec[]): CycleCountRec[] {
  const out: CycleCountRec[] = [];
  const active = WAREHOUSES.filter((w) => w.isActive);

  for (let i = 0; i < 18; i++) {
    const wh = pick(active);
    const byLocation = chance(0.6);
    const bins = locations.filter((l) => l.warehouseCode === wh.code && l.type === 'bin');
    const expected = int(90, 12400);
    const status = pick<CycleCountStatus>(['scheduled', 'in-progress', 'variance-review', 'closed', 'closed']);
    const variancePct = status === 'scheduled' ? 0 : chance(0.45) ? rand() * 0.06 : rand() * 0.01;
    const counted = Math.max(0, Math.round(expected * (1 - variancePct)));

    out.push({
      id: `cc-${i + 1}`,
      code: `CC-${110 + i}`,
      warehouseCode: wh.code,
      scopeLabel: byLocation && bins.length ? pick(bins).path : pick(skus).code,
      expectedQuantity: expected,
      countedQuantity: status === 'scheduled' ? expected : counted,
      status,
    });
  }

  return out;
}

/**
 * §12: a pick-task exception is classified by its actual cause, not lumped into
 * 'short-pick' by default. Exported as a pure function (rather than left inline in
 * {@link buildExceptions}) so the mapping is unit-testable independent of the seeded
 * sample, which may or may not happen to contain a wrong-barcode case on a given seed.
 */
export function classifyPickException(exceptionReason: string | undefined): ExceptionType {
  return exceptionReason === 'seed.exception.wrongBarcode' ? 'wrong-barcode' : 'short-pick';
}

function buildExceptions(
  pickTasks: PickTaskRec[],
  lines: ReceiptLineRec[],
  locations: LocationRec[],
  shipments: ShipmentRec[],
  allocations: AllocationRec[],
): ExceptionRec[] {
  const out: ExceptionRec[] = [];
  let n = 0;

  const push = (
    type: ExceptionType,
    severity: ExceptionSeverity,
    warehouseCode: string,
    referenceType: string,
    referenceId: string,
    minutesAgo: number,
  ) => {
    const resolved = chance(0.25);
    out.push({
      id: `ex-${++n}`,
      type,
      severity,
      warehouseCode,
      referenceType,
      referenceId,
      owner: chance(0.75) ? pick(OPERATORS) : undefined,
      status: resolved ? 'resolved' : chance(0.5) ? 'investigating' : 'open',
      createdAt: stamp(new Date(BASE_DATE.getTime() - minutesAgo * 60_000)),
      resolutionNote: resolved ? 'seed.resolution.corrected' : undefined,
      version: 1,
    });
  };

  // Exceptions are derived from the records that actually went wrong.
  for (const t of pickTasks.filter((t) => t.status === 'exception').slice(0, 8)) {
    push(
      classifyPickException(t.exceptionReason),
      pick<ExceptionSeverity>(['medium', 'high']),
      t.warehouseCode,
      'PickTask',
      t.code,
      int(2, 180),
    );
  }
  for (const l of lines.filter((l) => l.damagedQuantity > 0).slice(0, 5)) {
    push('damage', 'medium', WAREHOUSES[0].code, 'ReceiptLine', l.asnNumber, int(10, 300));
  }
  for (const l of locations.filter((l) => l.status === 'full').slice(0, 4)) {
    push('capacity-overflow', 'critical', l.warehouseCode, 'Location', l.path, int(20, 240));
  }
  for (const s of shipments.filter((s) => s.status === 'exception').slice(0, 3)) {
    push('shipment-mismatch', 'high', s.warehouseCode, 'Shipment', s.code, int(30, 400));
  }
  for (const a of allocations.filter((a) => a.overrideReason).slice(0, 4)) {
    push('manual-override', 'low', a.warehouseCode, 'SalesOrder', a.orderNumber, int(45, 500));
  }

  return out;
}

function buildMovements(
  lines: ReceiptLineRec[],
  putaway: PutawayRec[],
  pickTasks: PickTaskRec[],
  shipments: ShipmentRec[],
  cycleCounts: CycleCountRec[],
  allocations: AllocationRec[],
): MovementRec[] {
  const out: MovementRec[] = [];
  let n = 0;

  const at = (daysAgo: number, hour: number, minute: number): string => {
    const d = shiftDays(-daysAgo);
    d.setHours(hour, minute, 0, 0);
    return stamp(d);
  };

  for (const l of lines.filter((l) => l.receivedQuantity > 0)) {
    out.push({
      id: `mv-${++n}`,
      at: at(int(0, 7), int(6, 18), int(0, 59)),
      skuCode: l.skuCode,
      lot: l.lot,
      warehouseCode: WAREHOUSES[0].code,
      quantity: l.receivedQuantity,
      toLocation: 'STAGE/IN',
      type: 'receipt',
      reasonCode: l.asnNumber,
      performedBy: pick(OPERATORS),
    });
  }

  for (const p of putaway.filter((p) => p.accepted)) {
    out.push({
      id: `mv-${++n}`,
      at: at(int(0, 7), int(6, 20), int(0, 59)),
      skuCode: p.skuCode,
      lot: p.lot,
      warehouseCode: p.warehouseCode,
      quantity: p.quantity,
      fromLocation: 'STAGE/IN',
      toLocation: p.suggestedLocationPath,
      type: 'putaway',
      reasonCode: p.asnNumber,
      performedBy: 'System',
    });
  }

  for (const t of pickTasks.filter((t) => t.pickedLines > 0)) {
    const alloc = allocations.find((a) => a.warehouseCode === t.warehouseCode && a.quantity > 0);
    if (!alloc) continue;
    out.push({
      id: `mv-${++n}`,
      at: at(int(0, 5), int(7, 21), int(0, 59)),
      skuCode: alloc.skuCode,
      lot: alloc.lot,
      warehouseCode: t.warehouseCode,
      quantity: -Math.max(1, alloc.quantity),
      fromLocation: alloc.locationPath,
      toLocation: 'STAGE/OUT',
      type: 'pick',
      reasonCode: t.code,
      performedBy: t.assignedTo ?? 'System',
    });
  }

  for (const s of shipments) {
    out.push({
      id: `mv-${++n}`,
      at: at(int(0, 4), int(8, 22), int(0, 59)),
      skuCode: pick(allocations).skuCode,
      warehouseCode: s.warehouseCode,
      quantity: -int(50, 1200),
      fromLocation: 'STAGE/OUT',
      type: 'shipment',
      reasonCode: s.code,
      performedBy: pick(OPERATORS),
    });
  }

  for (const c of cycleCounts) {
    const delta = c.countedQuantity - c.expectedQuantity;
    if (delta === 0) continue;
    out.push({
      id: `mv-${++n}`,
      at: at(int(0, 9), int(6, 16), int(0, 59)),
      skuCode: pick(allocations).skuCode,
      warehouseCode: c.warehouseCode,
      quantity: delta,
      fromLocation: c.scopeLabel,
      type: 'cycle-count',
      reasonCode: c.code,
      performedBy: pick(OPERATORS),
    });
  }

  for (let i = 0; i < 40; i++) {
    const alloc = pick(allocations);
    out.push({
      id: `mv-${++n}`,
      at: at(int(0, 12), int(6, 20), int(0, 59)),
      skuCode: alloc.skuCode,
      lot: alloc.lot,
      warehouseCode: alloc.warehouseCode,
      quantity: -int(5, 120),
      fromLocation: alloc.locationPath,
      type: 'adjustment',
      reasonCode: `DMG-${String(int(1, 60)).padStart(3, '0')}`,
      performedBy: pick(OPERATORS),
    });
  }

  return out.sort((a, b) => b.at.localeCompare(a.at));
}

function buildAudit(
  waves: WaveRec[],
  packages: PackageRec[],
  pickTasks: PickTaskRec[],
  allocations: AllocationRec[],
  cycleCounts: CycleCountRec[],
): AuditRec[] {
  const out: AuditRec[] = [];
  let n = 0;

  const add = (
    actionType: string,
    targetType: string,
    targetId: string,
    oldValue: string | undefined,
    newValue: string | undefined,
    daysAgo: number,
  ) => {
    const d = shiftDays(-daysAgo);
    d.setHours(int(6, 21), int(0, 59), 0, 0);
    out.push({
      id: `ae-${++n}`,
      at: stamp(d),
      actor: pick(OPERATORS),
      actionType,
      targetType,
      targetId,
      oldValue,
      newValue,
    });
  };

  for (const w of waves.filter((w) => w.status === 'released' || w.status === 'completed').slice(0, 8)) {
    add('Wave Released', 'Wave', w.name, 'planned', 'released', int(0, 6));
  }
  for (const p of packages.filter((p) => p.status !== 'open').slice(0, 8)) {
    add('Package Sealed', 'Package', p.code, 'open', p.status, int(0, 5));
  }
  for (const t of pickTasks.filter((t) => t.status === 'completed').slice(0, 8)) {
    add('Pick Completed', 'PickTask', t.code, 'in-progress', 'completed', int(0, 5));
  }
  for (const a of allocations.filter((a) => a.overrideReason).slice(0, 6)) {
    add('Manual Override', 'SalesOrder', a.orderNumber, 'FEFO lot', a.lot ?? '—', int(0, 7));
  }
  for (const c of cycleCounts.filter((c) => c.countedQuantity !== c.expectedQuantity).slice(0, 6)) {
    add('Cycle Count Adjustment', 'StockMovement', c.code, String(c.expectedQuantity), String(c.countedQuantity), int(0, 9));
  }

  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/* ------------------------------------------------------------------ *
 * Assemble
 * ------------------------------------------------------------------ */

export interface Db {
  warehouses: WarehouseRec[];
  locations: LocationRec[];
  skus: SkuRec[];
  balances: BalanceRec[];
  orders: OrderRec[];
  allocations: AllocationRec[];
  waves: WaveRec[];
  pickTasks: PickTaskRec[];
  packages: PackageRec[];
  shipments: ShipmentRec[];
  asns: AsnRec[];
  receiptLines: ReceiptLineRec[];
  putaway: PutawayRec[];
  cycleCounts: CycleCountRec[];
  exceptions: ExceptionRec[];
  movements: MovementRec[];
  auditEvents: AuditRec[];
  operators: string[];
  carriers: string[];
}

function buildDb(): Db {
  const skus = buildSkus();
  const locations = buildLocations();
  const balances = buildBalances(skus, locations);
  const orders = buildOrders(skus);
  const { allocations, allocatedOrders } = buildAllocations(orders, balances, skus);
  const waves = buildWaves(orders, allocatedOrders);
  const pickTasks = buildPickTasks(waves, orders, locations);
  const packages = buildPackages(waves, orders, skus);
  const shipments = buildShipments(packages);
  const { asns, lines, putaway } = buildAsns(skus);
  const cycleCounts = buildCycleCounts(locations, skus);
  const exceptions = buildExceptions(pickTasks, lines, locations, shipments, allocations);
  const movements = buildMovements(lines, putaway, pickTasks, shipments, cycleCounts, allocations);
  const auditEvents = buildAudit(waves, packages, pickTasks, allocations, cycleCounts);

  return {
    warehouses: WAREHOUSES,
    locations,
    skus,
    balances,
    orders,
    allocations,
    waves,
    pickTasks,
    packages,
    shipments,
    asns,
    receiptLines: lines,
    putaway,
    cycleCounts,
    exceptions,
    movements,
    auditEvents,
    operators: OPERATORS,
    carriers: CARRIERS,
  };
}

/** Built once per bundle; services mutate it to simulate persistence within a session. */
export const db: Db = buildDb();
