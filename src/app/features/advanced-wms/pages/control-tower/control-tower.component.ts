import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { ControlTowerService, TowerEvent, TowerSnapshot } from '../../data-access/control-tower.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

type LoadState = 'loading' | 'success' | 'error';

const MAX_FEED = 8;

@Component({
  selector: 'app-control-tower',
  imports: [IconComponent, DecimalPipe],
  templateUrl: './control-tower.component.html',
  styleUrl: './control-tower.component.scss',
})
export class ControlTowerComponent {
  private readonly towerService = inject(ControlTowerService);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<LoadState>('loading');
  readonly snapshot = signal<TowerSnapshot | null>(null);
  readonly events = signal<TowerEvent[]>([]);
  readonly streaming = signal(true);

  constructor() {
    this.load();

    this.towerService
      .streamEvents()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (!this.streaming()) return;
        // Counters move with the feed so the page updates without a reload.
        this.events.update((list) => [event, ...list].slice(0, MAX_FEED));
        this.bumpCounters(event);
      });
  }

  load(): void {
    this.state.set('loading');
    this.towerService.getSnapshot().subscribe({
      next: (snapshot) => {
        this.snapshot.set(snapshot);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  toggleStream(): void {
    this.streaming.update((v) => !v);
  }

  clock(event: TowerEvent): string {
    return event.at.toLocaleTimeString('en-US', { hour12: false });
  }

  private bumpCounters(event: TowerEvent): void {
    const current = this.snapshot();
    if (!current) return;

    const deltas: Record<string, Partial<Record<string, number>>> = {
      'Toplama tamamlandı': { Reserved: -6, Available: -6, 'On Hand': -6 },
      'Kabul satırı işlendi': { 'On Hand': 12, Available: 12 },
      'Rezervasyon oluşturuldu': { Available: -4, Reserved: 4 },
      'Sevkiyat yüklemesi başladı': { 'In Transit': 8 },
      'İstisna açıldı': { Damaged: 1 },
    };

    const delta = deltas[event.label];
    if (!delta) return;

    this.snapshot.set({
      ...current,
      buckets: current.buckets.map((b) =>
        delta[b.label] ? { ...b, value: Math.max(0, b.value + (delta[b.label] as number)) } : b,
      ),
    });
  }
}
