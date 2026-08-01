import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, switchMap } from 'rxjs';
import { describeError } from '../../../../core/api/api-error';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ControlTowerService, TowerEvent, TowerSnapshot } from '../../data-access/control-tower.service';

type LoadState = 'loading' | 'success' | 'error';

const MAX_FEED = 10;

@Component({
  selector: 'app-control-tower',
  imports: [IconComponent, DecimalPipe],
  templateUrl: './control-tower.component.html',
  styleUrl: './control-tower.component.scss',
})
export class ControlTowerComponent {
  private readonly towerService = inject(ControlTowerService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly state = signal<LoadState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly snapshot = signal<TowerSnapshot | null>(null);
  readonly events = signal<TowerEvent[]>([]);
  readonly streaming = signal(true);

  readonly eventCount = computed(() => this.events().length);

  private streamSub: Subscription | null = null;

  constructor() {
    // Re-fetch and re-subscribe whenever the warehouse scope changes.
    toObservable(computed(() => this.scope.activeCodes()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((scope) => {
        this.load(scope);
        this.restartStream(scope);
      });

    effect(() => {
      // Pausing must stop the feed entirely, not just drop events on the floor.
      if (!this.streaming()) {
        this.streamSub?.unsubscribe();
        this.streamSub = null;
      } else if (!this.streamSub) {
        this.restartStream(this.scope.activeCodes());
      }
    });

    this.destroyRef.onDestroy(() => this.streamSub?.unsubscribe());
  }

  load(scope: string[] = this.scope.activeCodes()): void {
    this.state.set('loading');
    this.errorMessage.set(null);

    this.towerService.getSnapshot(scope).subscribe({
      next: (snapshot) => {
        this.snapshot.set(snapshot);
        this.state.set('success');
      },
      error: (err) => {
        this.errorMessage.set(describeError(err));
        this.state.set('error');
      },
    });
  }

  toggleStream(): void {
    this.streaming.update((v) => !v);
  }

  goTo(link: string): void {
    this.router.navigateByUrl(link);
  }

  clock(event: TowerEvent): string {
    return event.at.toLocaleTimeString('en-US', { hour12: false });
  }

  private restartStream(scope: string[]): void {
    this.streamSub?.unsubscribe();
    if (!this.streaming()) {
      this.streamSub = null;
      return;
    }

    this.streamSub = this.towerService.streamEvents(scope).subscribe((event) => {
      this.events.update((list) => [event, ...list].slice(0, MAX_FEED));
      this.bumpCounters(event);
    });
  }

  /** Counters move with the feed so the page updates without a full reload. */
  private bumpCounters(event: TowerEvent): void {
    const current = this.snapshot();
    if (!current) return;

    const deltas: Record<string, Partial<Record<string, number>>> = {
      'Toplama tamamlandı': { Reserved: -6, 'On Hand': -6 },
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
        delta[b.label] !== undefined ? { ...b, value: Math.max(0, b.value + (delta[b.label] as number)) } : b,
      ),
    });
  }
}
