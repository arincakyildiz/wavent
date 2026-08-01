import { Injectable, inject } from '@angular/core';
import { Observable, map, merge, timer } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { Tone } from './dashboard.service';
import { db } from './mock-data';
import { networkTotals, requiresSecondCount, withinWeightTolerance } from './selectors';

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
  label: string;
  detail: string;
  tone: Tone;
  icon: string;
}

const EVENT_TEMPLATES: Omit<TowerEvent, 'id' | 'at'>[] = [
  { label: 'Toplama tamamlandı', detail: '', tone: 'success', icon: 'target' },
  { label: 'Paket kapatıldı', detail: '', tone: 'info', icon: 'package' },
  { label: 'Kabul satırı işlendi', detail: '', tone: 'info', icon: 'inbox' },
  { label: 'İstisna açıldı', detail: '', tone: 'danger', icon: 'alertTriangle' },
  { label: 'Putaway önerisi kabul edildi', detail: '', tone: 'success', icon: 'putaway' },
  { label: 'Sevkiyat yüklemesi başladı', detail: '', tone: 'warning', icon: 'truck' },
  { label: 'Rezervasyon oluşturuldu', detail: '', tone: 'violet', icon: 'bookmark' },
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
        title: 'Stok farkı eşiği aşıldı',
        detail: `${c.code} · ${c.scopeLabel} · ${c.countedQuantity - c.expectedQuantity} adet`,
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
        title: 'Toplama görevinde istisna',
        detail: `${t.code} · ${t.assignedTo ?? 'atanmamış'} · ${t.exceptionReason}`,
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
        title: 'Riskli dalga',
        detail: `${w.name} · kapasite %${w.capacityUsedPct} · cut-off ${w.cutOffTime}`,
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
        title: 'Ağırlık toleransı dışında paket',
        detail: `${p.code} · ${p.weightKg} kg (beklenen ${p.expectedWeightKg} ±${p.toleranceKg})`,
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
        title: 'Lokasyon kapasitesi doldu',
        detail: `${l.path} · %${Math.round((l.usedWeightKg / l.maxWeightKg) * 100)} ağırlık kullanımı`,
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

    const detailFor = (label: string, tick: number): string => {
      const at = <T>(list: T[]): T | undefined => (list.length ? list[tick % list.length] : undefined);
      switch (label) {
        case 'Toplama tamamlandı': {
          const t = at(tasks);
          return t ? `${t.code} · ${t.assignedTo ?? 'System'} · ${t.lineCount} satır` : '—';
        }
        case 'Paket kapatıldı': {
          const p = at(packages);
          return p ? `${p.code} · ${p.weightKg} kg` : '—';
        }
        case 'Kabul satırı işlendi': {
          const l = at(lines);
          return l ? `${l.asnNumber} · ${l.skuCode} · ${l.receivedQuantity} adet` : '—';
        }
        case 'İstisna açıldı': {
          const t = at(tasks.filter((x) => x.status === 'exception'));
          return t ? `${t.exceptionReason} · ${t.code}` : 'Yanlış barkod';
        }
        case 'Putaway önerisi kabul edildi': {
          const p = at(putaway);
          return p ? `${p.suggestedLocationPath} · skor ${p.score}` : '—';
        }
        case 'Sevkiyat yüklemesi başladı': {
          const s = at(shipments);
          return s ? `${s.code} · ${s.carrier} · kapı ${s.door}` : '—';
        }
        default: {
          const a = at(allocations);
          return a ? `${a.orderNumber} · ${a.strategy} · ${a.quantity} adet` : '—';
        }
      }
    };

    const streams = [2600, 4100, 5700].map((period, streamIndex) =>
      timer(1200 + streamIndex * 700, period).pipe(
        map((tick) => {
          const template = EVENT_TEMPLATES[(tick * 3 + streamIndex * 2) % EVENT_TEMPLATES.length];
          return {
            ...template,
            detail: detailFor(template.label, tick + streamIndex),
            id: `ev-${streamIndex}-${tick}-${Date.now()}`,
            at: new Date(),
          } satisfies TowerEvent;
        }),
      ),
    );
    return merge(...streams);
  }
}
