import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { DashboardService, DashboardSummary } from '../../data-access/dashboard.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SparklineComponent } from '../../../../shared/components/sparkline/sparkline.component';
import { DonutChartComponent } from '../../../../shared/components/donut-chart/donut-chart.component';
import { BarChartComponent } from '../../../../shared/components/bar-chart/bar-chart.component';
import { WorldMapComponent } from '../../../../shared/components/world-map/world-map.component';

type LoadState = 'loading' | 'success' | 'error';

const TONE_HEX: Record<string, string> = {
  info: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  violet: '#a855f7',
  neutral: '#64748b',
};

@Component({
  selector: 'app-overview',
  imports: [IconComponent, SparklineComponent, DonutChartComponent, BarChartComponent, WorldMapComponent],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
})
export class OverviewComponent {
  private readonly dashboard = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<LoadState>('loading');
  readonly summary = signal<DashboardSummary | null>(null);
  readonly lastUpdated = signal(new Date());
  readonly warehouseFilter = signal('all');
  readonly period = signal('May 20, 2024');

  readonly waveTotal = computed(() =>
    (this.summary()?.waveSegments ?? []).reduce((sum, s) => sum + s.value, 0),
  );

  constructor() {
    this.load();

    // Keeps the "Live" footer honest — the control tower clock ticks on its own.
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.lastUpdated.set(new Date()));
  }

  load(): void {
    this.state.set('loading');
    this.dashboard.getSummary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.lastUpdated.set(new Date());
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  toneHex(tone: string): string {
    return TONE_HEX[tone] ?? TONE_HEX['info'];
  }

  segmentPct(value: number): string {
    const total = this.waveTotal();
    if (!total) return '0';
    return (Math.round((value / total) * 1000) / 10).toFixed(1);
  }

  clock(): string {
    return this.lastUpdated().toLocaleTimeString('en-US', { hour12: true });
  }
}
