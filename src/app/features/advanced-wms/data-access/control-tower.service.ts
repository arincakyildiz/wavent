import { Injectable, inject } from '@angular/core';
import { Observable, map, merge, timer } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { Tone } from './dashboard.service';

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
}

export interface TowerSnapshot {
  buckets: StockBucket[];
  alerts: TowerAlert[];
}

/** One event off the simulated task stream. */
export interface TowerEvent {
  id: string;
  at: Date;
  label: string;
  detail: string;
  tone: Tone;
  icon: string;
}

const SNAPSHOT: TowerSnapshot = {
  buckets: [
    { label: 'On Hand', value: 145240, tone: 'info', icon: 'boxes' },
    { label: 'Available', value: 102430, tone: 'success', icon: 'package' },
    { label: 'Reserved', value: 32810, tone: 'warning', icon: 'bookmark' },
    { label: 'Quarantine', value: 1240, tone: 'violet', icon: 'clipboardCheck' },
    { label: 'Damaged', value: 380, tone: 'danger', icon: 'alertTriangle' },
    { label: 'In Transit', value: 10250, tone: 'info', icon: 'truck' },
  ],
  alerts: [
    { id: 'al-1', title: 'Stok farkı eşiği aşıldı', detail: 'CC-119 · SKU-1006 · -600 adet', tone: 'danger', icon: 'clipboardCheck' },
    { id: 'al-2', title: 'Geciken toplama görevi', detail: 'PK-2790 · Jessica Park · 24 dk gecikme', tone: 'warning', icon: 'target' },
    { id: 'al-3', title: 'Riskli dalga', detail: 'Wave #254 · kapasite %95 · cut-off 20:00', tone: 'warning', icon: 'waves' },
    { id: 'al-4', title: 'Sevkiyat kesim uyarısı', detail: 'SHP-7817 · Aramex · 45 dk kaldı', tone: 'danger', icon: 'truck' },
    { id: 'al-5', title: 'Lokasyon kapasitesi doldu', detail: 'A/01/02 · %99 ağırlık kullanımı', tone: 'violet', icon: 'warehouse' },
  ],
};

const EVENT_TEMPLATES: Omit<TowerEvent, 'id' | 'at'>[] = [
  { label: 'Toplama tamamlandı', detail: 'PK-2815 · John Doe · 6 satır', tone: 'success', icon: 'target' },
  { label: 'Paket kapatıldı', detail: 'PK-4501 · 4.2 kg · tolerans içinde', tone: 'info', icon: 'package' },
  { label: 'Kabul satırı işlendi', detail: 'ASN-4887 · SKU-1001 · 3200 adet', tone: 'info', icon: 'inbox' },
  { label: 'İstisna açıldı', detail: 'Yanlış barkod · PK-2815', tone: 'danger', icon: 'alertTriangle' },
  { label: 'Putaway önerisi kabul edildi', detail: 'A/02/01 · skor 88', tone: 'success', icon: 'putaway' },
  { label: 'Sevkiyat yüklemesi başladı', detail: 'SHP-7819 · FedEx · kapı D-01', tone: 'warning', icon: 'truck' },
  { label: 'Rezervasyon oluşturuldu', detail: 'SO-10586 · FIFO · 60 adet', tone: 'violet', icon: 'bookmark' },
];

@Injectable({ providedIn: 'root' })
export class ControlTowerService {
  private readonly api = inject(MockApiService);

  getSnapshot(): Observable<TowerSnapshot> {
    return this.api.simulate(SNAPSHOT, { delayMs: 350 });
  }

  /**
   * Stand-in for a WebSocket/SSE feed: emits task events on an irregular
   * cadence so the control tower can update without a full page reload.
   */
  streamEvents(): Observable<TowerEvent> {
    const streams = [2600, 4100, 5700].map((period, streamIndex) =>
      timer(1200 + streamIndex * 700, period).pipe(
        map((tick) => {
          const template = EVENT_TEMPLATES[(tick * 3 + streamIndex * 2) % EVENT_TEMPLATES.length];
          return {
            ...template,
            id: `ev-${streamIndex}-${tick}-${Date.now()}`,
            at: new Date(),
          } satisfies TowerEvent;
        }),
      ),
    );
    return merge(...streams);
  }
}
