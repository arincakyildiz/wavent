import { Injectable, inject } from '@angular/core';
import { Observable, map, merge, timer } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { Tone } from './dashboard.service';
import { db } from './mock-data';
import { networkTotals, requiresSecondCount, withinWeightTolerance } from './selectors';
import { translate } from '../../../core/i18n/i18n.service';

export interface StockBucket {
  label: string;
  value: number;
  tone: Tone;
  icon: string;
}

export interface TowerAlert {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  icon: string;
  link: string;
}

export interface TowerSnapshot {
  buckets: StockBucket[];
  alerts: TowerAlert[];
}

export interface TowerEvent {
  id: string;
  at: Date;
  /** Stable identity — the label is a translation of this, so never switch on the label. */
  kind: EventKind;
  label: string;
  detail: string;
  tone: Tone;
  icon: string;
}

export type EventKind =
  | 'pickCompleted'
  | 'packageClosed'
  | 'receiptLine'
  | 'exceptionOpened'
  | 'putawayAccepted'
  | 'loadingStarted'
  | 'reservationCreated';

const EVENT_TEMPLATES: { kind: EventKind; tone: Tone; icon: string }[] = [
  { kind: 'pickCompleted', tone: 'success', icon: 'target' },
  { kind: 'packageClosed', tone: 'info', icon: 'package' },
  { kind: 'receiptLine', tone: 'info', icon: 'inbox' },
  { kind: 'exceptionOpened', tone: 'danger', icon: 'alertTriangle' },
  { kind: 'putawayAccepted', tone: 'success', icon: 'putaway' },
  { kind: 'loadingStarted', tone: 'warning', icon: 'truck' },
  { kind: 'reservationCreated', tone: 'violet', icon: 'bookmark' },
];

@Injectable({ providedIn: 'root' })
export class ControlTowerService {
  private readonly api = inject(MockApiService);

  getSnapshot(scope: string[]): Observable<TowerSnapshot> {
    return this.api.simulate(scope, { delayMs: 340 }).pipe(map(() => this.build(scope)));
  }

  private build(scope: string[]): TowerSnapshot {
    const totals = networkTotals(scope);
    const inScope = (code: string) => !scope.length || scope.includes(code);

    const alerts: TowerAlert[] = [];

    for (const c of db.cycleCounts.filter(
      (c) => inScope(c.warehouseCode) && requiresSecondCount(c.expectedQuantity, c.countedQuantity),
    ).slice(0, 2)) {
      alerts.push({
        id: `al-${c.id}`,
        title: translate('tower.alert.variance'),
        detail: translate('tower.alert.varianceDetail', {
          code: c.code,
          scope: c.scopeLabel,
          delta: c.countedQuantity - c.expectedQuantity,
        }),
        tone: 'danger',
        icon: 'clipboardCheck',
        link: '/wms/cycle-counts',
      });
    }

    for (const t of db.pickTasks.filter(
      (t) => inScope(t.warehouseCode) && t.status === 'exception',
    ).slice(0, 2)) {
      alerts.push({
        id: `al-${t.id}`,
        title: translate('tower.alert.pickException'),
        detail: translate('tower.alert.pickExceptionDetail', {
          code: t.code,
          owner: t.assignedTo ?? translate('tower.unassigned'),
          reason: translate(t.exceptionReason ?? ''),
        }),
        tone: 'warning',
        icon: 'target',
        link: '/wms/picking/tasks',
      });
    }

    for (const w of db.waves.filter(
      (w) => inScope(w.warehouseCode) && w.capacityUsedPct >= 90 && w.status !== 'completed',
    ).slice(0, 2)) {
      alerts.push({
        id: `al-${w.id}`,
        title: translate('tower.alert.riskyWave'),
        detail: translate('tower.alert.riskyWaveDetail', {
          name: w.name,
          pct: w.capacityUsedPct,
          cutOff: w.cutOffTime,
        }),
        tone: 'warning',
        icon: 'waves',
        link: '/wms/waves',
      });
    }

    for (const p of db.packages.filter(
      (p) => inScope(p.warehouseCode) && !withinWeightTolerance(p),
    ).slice(0, 2)) {
      alerts.push({
        id: `al-${p.id}`,
        title: translate('tower.alert.weight'),
        detail: translate('tower.alert.weightDetail', {
          code: p.code,
          weight: p.weightKg,
          expected: p.expectedWeightKg,
          tolerance: p.toleranceKg,
        }),
        tone: 'danger',
        icon: 'package',
        link: '/wms/packing',
      });
    }

    for (const l of db.locations.filter(
      (l) => inScope(l.warehouseCode) && l.status === 'full',
    ).slice(0, 2)) {
      alerts.push({
        id: `al-${l.id}`,
        title: translate('tower.alert.locationFull'),
        detail: translate('tower.alert.locationFullDetail', {
          path: l.path,
          pct: Math.round((l.usedWeightKg / l.maxWeightKg) * 100),
        }),
        tone: 'violet',
        icon: 'warehouse',
        link: '/wms/locations',
      });
    }

    return {
      buckets: [
        { label: 'On Hand', value: totals.onHand, tone: 'info', icon: 'boxes' },
        { label: 'Available', value: totals.available, tone: 'success', icon: 'package' },
        { label: 'Reserved', value: totals.reserved, tone: 'warning', icon: 'bookmark' },
        { label: 'Quarantine', value: totals.quarantine, tone: 'violet', icon: 'clipboardCheck' },
        { label: 'Damaged', value: totals.damaged, tone: 'danger', icon: 'alertTriangle' },
        { label: 'In Transit', value: totals.inTransit, tone: 'info', icon: 'truck' },
      ],
      alerts,
    };
  }

  /**
   * Stand-in for a WebSocket/SSE feed. Details are drawn from real records so the feed
   * references tasks, packages and orders that actually exist.
   */
  streamEvents(scope: string[]): Observable<TowerEvent> {
    const inScope = (code: string) => !scope.length || scope.includes(code);
    const tasks = db.pickTasks.filter((t) => inScope(t.warehouseCode));
    const packages = db.packages.filter((p) => inScope(p.warehouseCode));
    const lines = db.receiptLines;
    const allocations = db.allocations.filter((a) => inScope(a.warehouseCode));
    const shipments = db.shipments.filter((s) => inScope(s.warehouseCode));
    const putaway = db.putaway.filter((p) => inScope(p.warehouseCode));

    const detailFor = (kind: EventKind, tick: number): string => {
      const at = <T>(list: T[]): T | undefined => (list.length ? list[tick % list.length] : undefined);
      switch (kind) {
        case 'pickCompleted': {
          const t = at(tasks);
          return t
            ? translate('tower.detail.pick', {
                code: t.code,
                owner: t.assignedTo ?? 'System',
                lines: t.lineCount,
              })
            : '—';
        }
        case 'packageClosed': {
          const p = at(packages);
          return p ? translate('tower.detail.package', { code: p.code, weight: p.weightKg }) : '—';
        }
        case 'receiptLine': {
          const l = at(lines);
          return l
            ? translate('tower.detail.receipt', {
                asn: l.asnNumber,
                sku: l.skuCode,
                qty: l.receivedQuantity,
              })
            : '—';
        }
        case 'exceptionOpened': {
          const t = at(tasks.filter((x) => x.status === 'exception'));
          return t
            ? translate('tower.detail.exception', {
                reason: translate(t.exceptionReason ?? ''),
                code: t.code,
              })
            : translate('seed.exception.wrongBarcode');
        }
        case 'putawayAccepted': {
          const p = at(putaway);
          return p
            ? translate('tower.detail.putaway', { path: p.suggestedLocationPath, score: p.score })
            : '—';
        }
        case 'loadingStarted': {
          const s = at(shipments);
          return s
            ? translate('tower.detail.loading', { code: s.code, carrier: s.carrier, door: s.door })
            : '—';
        }
        default: {
          const a = at(allocations);
          return a
            ? translate('tower.detail.reservation', {
                order: a.orderNumber,
                strategy: a.strategy,
                qty: a.quantity,
              })
            : '—';
        }
      }
    };

    const streams = [2600, 4100, 5700].map((period, streamIndex) =>
      timer(1200 + streamIndex * 700, period).pipe(
        map((tick) => {
          const template = EVENT_TEMPLATES[(tick * 3 + streamIndex * 2) % EVENT_TEMPLATES.length];
          return {
            ...template,
            label: translate(`tower.event.${template.kind}`),
            detail: detailFor(template.kind, tick + streamIndex),
            id: `ev-${streamIndex}-${tick}-${Date.now()}`,
            at: new Date(),
          } satisfies TowerEvent;
        }),
      ),
    );
    return merge(...streams);
  }
}
