import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, interval, of, switchMap } from 'rxjs';
import { describeError } from '../../../../core/api/api-error';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SparklineComponent } from '../../../../shared/components/sparkline/sparkline.component';
import { DonutChartComponent } from '../../../../shared/components/donut-chart/donut-chart.component';
import { BarChartComponent } from '../../../../shared/components/bar-chart/bar-chart.component';
import { WorldMapComponent } from '../../../../shared/components/world-map/world-map.component';
import { bindQueryParams, parseString } from '../../../../shared/utils/query-params';
import {
  DashboardService,
  DashboardSummary,
  PERIOD_LABELS,
  Period,
} from '../../data-access/dashboard.service';

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
  private readonly scope = inject(WarehouseScopeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly period = signal<Period>('today');
  readonly periodLabels = PERIOD_LABELS;
  readonly periods: Period[] = ['today', '7d', '30d'];

  readonly scopeLabel = this.scope.label;
  readonly warehouses = this.scope.permitted;
  readonly selectedScope = this.scope.selected;
  readonly canChooseScope = this.scope.canChoose;

  readonly lastUpdated = signal(new Date());
  readonly errorMessage = signal<string | null>(null);
  private readonly reloadToken = signal(0);

  private readonly summaryResult = toSignal(
    toObservable(
      computed(() => ({
        scope: this.scope.activeCodes(),
        period: this.period(),
        token: this.reloadToken(),
      })),
    ).pipe(
      switchMap(({ scope, period }) => {
        this.errorMessage.set(null);
        return this.dashboard.getSummary(scope, period).pipe(
          catchError((err) => {
            this.errorMessage.set(describeError(err));
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );

  readonly summary = computed<DashboardSummary | null>(() => this.summaryResult() ?? null);
  readonly loading = computed(() => this.summaryResult() === undefined && !this.errorMessage());

  readonly waveTotal = computed(() =>
    (this.summary()?.waveSegments ?? []).reduce((sum, s) => sum + s.value, 0),
  );

  constructor() {
    bindQueryParams([
      {
        param: 'period',
        signal: this.period,
        defaultValue: 'today' as Period,
        parse: (raw) => (['today', '7d', '30d'].includes(raw) ? (raw as Period) : 'today'),
      },
    ]);

    // Keeps the "Live" footer honest — the control tower clock ticks on its own.
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.lastUpdated.set(new Date()));
  }

  reload(): void {
    this.reloadToken.update((n) => n + 1);
    this.lastUpdated.set(new Date());
  }

  selectScope(code: string): void {
    this.scope.select(code);
  }

  go(link: string): void {
    this.router.navigateByUrl(link);
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
