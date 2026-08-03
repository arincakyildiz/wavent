import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { WaveRow, WavesService } from '../data-access/waves.service';

/**
 * Feature store for wave planning.
 *
 * The Waves list and the Wave detail screen look at the same records, so the list
 * publishes what it loaded here and the detail screen reads it before falling back
 * to the network. That removes the refetch on list → detail navigation while still
 * working on a cold deep-link, and gives both screens one definition of "at risk".
 *
 * Deliberately a signal store rather than a full NgRx setup: the state is small and
 * the mock transport is the source of truth, so a reducer/action layer would be
 * ceremony without a payoff.
 */
@Injectable({ providedIn: 'root' })
export class WavePlanningStore {
  private readonly wavesService = inject(WavesService);

  private readonly waves = signal<WaveRow[]>([]);
  private readonly selectedId = signal<string | null>(null);
  private readonly loadedScope = signal<string>('');

  /* ---------- Selectors ---------- */

  readonly allWaves = this.waves.asReadonly();

  /** Waves that can still be planned or published. */
  readonly actionableWaves = computed(() =>
    this.waves().filter((w) => w.status === 'draft' || w.status === 'planned'),
  );

  /** Waves whose orders would fail or be at risk if published now. */
  readonly atRiskWaves = computed(() => this.actionableWaves().filter((w) => w.riskCount > 0));

  readonly atRiskCount = computed(() => this.atRiskWaves().length);

  readonly selectedWave = computed(() => {
    const id = this.selectedId();
    return id ? (this.waves().find((w) => w.id === id) ?? null) : null;
  });

  /** Mean shift utilisation across the actionable waves. */
  readonly averageCapacityPct = computed(() => {
    const rows = this.actionableWaves();
    if (!rows.length) return 0;
    return Math.round(rows.reduce((sum, w) => sum + w.capacityUsedPct, 0) / rows.length);
  });

  /* ---------- Mutations ---------- */

  /** Publishes what a list screen just loaded, keyed by the scope it was loaded for. */
  setWaves(rows: WaveRow[], scope: string[]): void {
    this.waves.set(rows);
    this.loadedScope.set(scope.join(','));
  }

  select(id: string | null): void {
    this.selectedId.set(id);
  }

  /** Replaces one wave after a write, so every screen sees the new status/version. */
  upsert(wave: WaveRow): void {
    this.waves.update((rows) => {
      const index = rows.findIndex((w) => w.id === wave.id);
      if (index === -1) return [...rows, wave];

      const next = [...rows];
      next[index] = wave;
      return next;
    });
  }

  clear(): void {
    this.waves.set([]);
    this.selectedId.set(null);
    this.loadedScope.set('');
  }

  /* ---------- Effects ---------- */

  /**
   * Resolves one wave: served from the store on a list → detail hop, fetched when
   * the screen was opened cold. The fetched row is cached so a reload is instant.
   */
  loadWave(id: string): Observable<WaveRow> {
    const cached = this.waves().find((w) => w.id === id);
    if (cached) {
      this.select(id);
      return of(cached);
    }

    return this.wavesService.getById(id).pipe(
      tap((wave) => {
        this.upsert(wave);
        this.select(id);
      }),
    );
  }

  /** True when the store already holds data for this scope. */
  hasScope(scope: string[]): boolean {
    return this.loadedScope() === scope.join(',') && this.waves().length > 0;
  }
}
