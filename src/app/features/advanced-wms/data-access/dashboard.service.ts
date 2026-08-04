import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { DonutSegment } from '../../../shared/components/donut-chart/donut-chart.component';
import { BarDatum } from '../../../shared/components/bar-chart/bar-chart.component';
import { MapMarker } from '../../../shared/components/world-map/world-map.component';
import { db } from './mock-data';
import { inventoryByWarehouse, networkTotals } from './selectors';
import { translate } from '../../../core/i18n/i18n.service';

export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'violet' | 'neutral';

/** Period the header selector offers; changes both totals and the trend series. */
export type Period = 'today' | '7d' | '30d';

export const PERIOD_LABELS: Record<Period, string> = {
  today: translate('period.today'),
  '7d': translate('period.7d'),
  '30d': translate('period.30d'),
};

export interface KpiCard {
  label: string;
  value: string;
  hint: string;
  trend: 'up' | 'down' | 'flat';
  icon: string;
  tone: Tone;
  spark: number[];
  /** Route the card drills into. */
  link: string;
}

export interface ExceptionItem {
  id: string;
  title: string;
  reference: string;
  actor: string;
  ago: string;
  icon: string;
  tone: Tone;
}

export interface TimelineItem {
  title: string;
  timestamp: string;
  icon: string;
  tone: Tone;
}

export interface Operator {
  name: string;
  initials: string;
  tone: Tone;
}

export interface TaskPerformance {
  unitLabel: string;
  max: number;
  tickStep: number;
  bars: BarDatum[];
  operators: Operator[];
}

export interface ShipmentSummaryRow {
  code: string;
  carrier: string;
  status: string;
  tone: Tone;
  progressPct: number;
}

export interface TodayStat {
  label: string;
  value: string;
  unit: string;
  secondary: string;
  icon: string;
  tone: Tone;
  link: string;
}

export interface DashboardSummary {
  kpis: KpiCard[];
  mapPoints: MapMarker[];
  waveSegments: DonutSegment[];
  exceptions: ExceptionItem[];
  timeline: TimelineItem[];
  performance: TaskPerformance;
  shipments: ShipmentSummaryRow[];
  today: TodayStat[];
}

const EXCEPTION_ICON: Record<string, string> = {
  'wrong-barcode': 'scanLine',
  'short-pick': 'target',
  damage: 'package',
  'capacity-overflow': 'warehouse',
  'manual-override': 'fileText',
  'shipment-mismatch': 'truck',
};

const EXCEPTION_TONE: Record<string, Tone> = {
  low: 'info',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
};

const TONE_CYCLE: Tone[] = ['info', 'success', 'warning', 'violet', 'neutral'];

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function pct(part: number, whole: number): string {
  return whole ? `${((part / whole) * 100).toFixed(2)}% of total` : '—';
}

/** Deterministic pseudo-trend so the sparkline shape is stable per metric and period. */
function series(seed: number, end: number, points: number): number[] {
  const out: number[] = [];
  let value = end * 0.82;
  for (let i = 0; i < points; i++) {
    const wobble = Math.sin((seed + i) * 1.7) * 0.05 + 0.022;
    value = value * (1 + wobble);
    out.push(Math.max(1, Math.round(value)));
  }
  out[out.length - 1] = Math.max(1, Math.round(end));
  return out;
}

const POINTS: Record<Period, number> = { today: 8, '7d': 12, '30d': 16 };

function agoLabel(createdAt: string): string {
  // createdAt is 'YYYY-MM-DD HH:mm' relative to the fixed demo clock.
  const now = new Date('2026-07-30T10:25:00');
  const parsed = new Date(createdAt.replace(' ', 'T'));
  const minutes = Math.max(1, Math.round((now.getTime() - parsed.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(MockApiService);

  /** Everything is derived from the shared dataset, filtered by the active scope. */
  getSummary(scope: string[], period: Period): Observable<DashboardSummary> {
    return this.api.simulate({ scope, period }, { delayMs: 400 }).pipe(map(() => this.build(scope, period)));
  }

  private build(scope: string[], period: Period): DashboardSummary {
    const totals = networkTotals(scope);
    const points = POINTS[period];
    const inScope = (code: string) => !scope.length || scope.includes(code);

    const waves = db.waves.filter((w) => inScope(w.warehouseCode));
    const waveCounts = {
      draft: waves.filter((w) => w.status === 'draft').length,
      planned: waves.filter((w) => w.status === 'planned').length,
      released: waves.filter((w) => w.status === 'released').length,
      completed: waves.filter((w) => w.status === 'completed').length,
    };

    const openExceptions = db.exceptions
      .filter((e) => inScope(e.warehouseCode) && e.status !== 'resolved')
      .slice(0, 4);

    const tasks = db.pickTasks.filter((t) => inScope(t.warehouseCode));
    const perOperator = new Map<string, number>();
    for (const t of tasks) {
      if (!t.assignedTo) continue;
      perOperator.set(t.assignedTo, (perOperator.get(t.assignedTo) ?? 0) + t.pickedLines);
    }
    const topOperators = [...perOperator.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxLines = Math.max(50, ...topOperators.map(([, v]) => v));
    const axisMax = Math.ceil(maxLines / 50) * 50;

    const shipments = db.shipments.filter((s) => inScope(s.warehouseCode)).slice(0, 5);

    const receivingToday = db.asns.filter((a) => inScope(a.warehouseCode) && a.status === 'receiving');
    const putawayPending = db.putaway.filter((p) => inScope(p.warehouseCode) && !p.accepted);
    const pickingActive = tasks.filter((t) => t.status !== 'completed');
    const packingOpen = db.packages.filter(
      (p) => inScope(p.warehouseCode) && p.status !== 'shipped',
    );
    const shippingActive = db.shipments.filter(
      (s) => inScope(s.warehouseCode) && s.status !== 'delivered',
    );

    return {
      kpis: [
        {
          label: 'Total Inventory',
          value: fmt(totals.onHand),
          hint: `${period === 'today' ? '+2.45% vs yesterday' : translate('dashboard.vsPrevious', { pct: (4 + points * 0.3).toFixed(2) })}`,
          trend: 'up',
          icon: 'boxes',
          tone: 'info',
          spark: series(1, totals.onHand / 1000, points),
          link: '/wms/inventory',
        },
        {
          label: 'Available',
          value: fmt(totals.available),
          hint: pct(totals.available, totals.onHand),
          trend: 'up',
          icon: 'package',
          tone: 'success',
          spark: series(2, totals.available / 1000, points),
          link: '/wms/inventory',
        },
        {
          label: 'Reserved',
          value: fmt(totals.reserved),
          hint: pct(totals.reserved, totals.onHand),
          trend: 'flat',
          icon: 'bookmark',
          tone: 'warning',
          spark: series(3, totals.reserved / 1000, points),
          link: '/wms/reservations',
        },
        {
          label: 'In Transit',
          value: fmt(totals.inTransit),
          hint: pct(totals.inTransit, totals.onHand),
          trend: 'flat',
          icon: 'truck',
          tone: 'info',
          spark: series(4, Math.max(1, totals.inTransit / 1000), points),
          link: '/wms/shipping',
        },
        {
          label: 'Exceptions',
          value: fmt(totals.openExceptions),
          hint: '-12.50% vs yesterday',
          trend: 'down',
          icon: 'alertTriangle',
          tone: 'danger',
          spark: series(5, Math.max(1, totals.openExceptions), points).reverse(),
          link: '/wms/exceptions',
        },
      ],
      mapPoints: inventoryByWarehouse()
        .filter((i) => inScope(i.code) && i.units > 0)
        .map((i, idx) => {
          const wh = db.warehouses.find((w) => w.code === i.code)!;
          return {
            city: wh.city,
            lon: wh.lon,
            lat: wh.lat,
            value: i.units,
            anchor: idx % 3 === 0 ? 'end' : idx % 3 === 1 ? 'middle' : 'start',
            above: idx % 2 === 0,
          } satisfies MapMarker;
        }),
      waveSegments: [
        { label: 'Draft', value: waveCounts.draft, color: '#64748b' },
        { label: 'Planned', value: waveCounts.planned, color: '#3b82f6' },
        { label: 'Released', value: waveCounts.released, color: '#22c55e' },
        { label: 'Completed', value: waveCounts.completed, color: '#a855f7' },
      ],
      exceptions: openExceptions.map((e) => ({
        id: e.id,
        title: e.type
          .split('-')
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(' '),
        reference: e.referenceId,
        actor: e.owner ?? 'System',
        ago: agoLabel(e.createdAt),
        icon: EXCEPTION_ICON[e.type] ?? 'alertTriangle',
        tone: EXCEPTION_TONE[e.severity] ?? 'warning',
      })),
      timeline: this.buildTimeline(scope),
      performance: {
        unitLabel: 'Lines / Hour',
        max: axisMax,
        tickStep: axisMax / 4,
        bars: topOperators.map(([name, value]) => ({ label: name.split(' ')[0] + '.', value })),
        operators: topOperators.map(([name], i) => ({
          name,
          initials: name
            .split(' ')
            .map((p) => p[0])
            .join(''),
          tone: TONE_CYCLE[i % TONE_CYCLE.length],
        })),
      },
      shipments: shipments.map((s) => ({
        code: s.code,
        carrier: s.carrier,
        status: s.status
          .split('-')
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(' '),
        tone:
          s.status === 'delivered' || s.status === 'loading'
            ? 'success'
            : s.status === 'exception'
              ? 'danger'
              : s.status === 'staged'
                ? 'warning'
                : 'info',
        progressPct: s.progressPct,
      })),
      today: [
        {
          label: 'Receiving Today',
          value: String(receivingToday.length),
          unit: 'ASN',
          secondary: `${db.receiptLines.filter((l) => receivingToday.some((a) => a.number === l.asnNumber)).length} Lines`,
          icon: 'inbox',
          tone: 'info',
          link: '/wms/receiving',
        },
        {
          label: 'Putaway Today',
          value: String(putawayPending.length),
          unit: 'Tasks',
          secondary: `${fmt(putawayPending.reduce((s, p) => s + p.quantity, 0))} Units`,
          icon: 'putaway',
          tone: 'success',
          link: '/wms/putaway',
        },
        {
          label: 'Picking Today',
          value: String(pickingActive.length),
          unit: 'Tasks',
          secondary: `${fmt(pickingActive.reduce((s, t) => s + t.lineCount, 0))} Lines`,
          icon: 'target',
          tone: 'violet',
          link: '/wms/picking/tasks',
        },
        {
          label: 'Packing Today',
          value: String(packingOpen.length),
          unit: 'Tasks',
          secondary: `${fmt(packingOpen.reduce((s, p) => s + p.itemCount, 0))} Items`,
          icon: 'package',
          tone: 'info',
          link: '/wms/packing',
        },
        {
          label: 'Shipping Today',
          value: String(shippingActive.length),
          unit: 'Shipments',
          secondary: `${fmt(shippingActive.reduce((s, x) => s + x.packageCodes.length, 0))} Packages`,
          icon: 'truck',
          tone: 'warning',
          link: '/wms/shipping',
        },
      ],
    };
  }

  /** Most recent real events across waves, tasks, shipments, exceptions and receipts. */
  private buildTimeline(scope: string[]): TimelineItem[] {
    const inScope = (code: string) => !scope.length || scope.includes(code);
    const items: TimelineItem[] = [];

    const wave = db.waves.find((w) => inScope(w.warehouseCode) && w.status === 'released');
    if (wave) {
      items.push({
        title: `${wave.name} published`,
        timestamp: translate('dashboard.orderCount', { count: wave.orderNumbers.length, carrier: wave.carrier }),
        icon: 'checkCircle',
        tone: 'success',
      });
    }

    const task = db.pickTasks.find((t) => inScope(t.warehouseCode) && t.status === 'completed');
    if (task) {
      items.push({
        title: `Picking task ${task.code} completed`,
        timestamp: translate('dashboard.lineCount', { count: task.lineCount, owner: task.assignedTo ?? 'System' }),
        icon: 'target',
        tone: 'info',
      });
    }

    const shipment = db.shipments.find((s) => inScope(s.warehouseCode) && s.closedAt);
    if (shipment) {
      items.push({
        title: `Shipment ${shipment.code} closed`,
        timestamp: `${shipment.closedAt} · ${shipment.carrier}`,
        icon: 'truck',
        tone: 'success',
      });
    }

    const exception = db.exceptions.find((e) => inScope(e.warehouseCode) && e.status !== 'resolved');
    if (exception) {
      items.push({
        title: `Exception created - ${exception.type}`,
        timestamp: `${exception.createdAt} · ${exception.referenceId}`,
        icon: 'alertTriangle',
        tone: 'danger',
      });
    }

    const asn = db.asns.find((a) => inScope(a.warehouseCode) && a.status === 'receiving');
    if (asn) {
      items.push({
        title: `ASN ${asn.number} received`,
        timestamp: `${asn.supplierName} · ${asn.expectedDate}`,
        icon: 'inbox',
        tone: 'info',
      });
    }

    return items;
  }
}
