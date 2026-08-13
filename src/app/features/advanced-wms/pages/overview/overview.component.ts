import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, interval, map, switchMap, tap } from 'rxjs';
import { describeError } from '../../../../core/api/api-error';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { IndexedDbService } from '../../../../core/storage/indexed-db.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SparklineComponent } from '../../../../shared/components/sparkline/sparkline.component';
import { DonutChartComponent } from '../../../../shared/components/donut-chart/donut-chart.component';
import { BarChartComponent } from '../../../../shared/components/bar-chart/bar-chart.component';
import { WorldMapComponent } from '../../../../shared/components/world-map/world-map.component';
import { bindQueryParams } from '../../../../shared/utils/query-params';
import {
  DashboardService,
  DashboardSummary,
  PERIOD_LABELS,
  Period,
} from '../../data-access/dashboard.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { DemoDataService } from '../../data-access/demo-data.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permission } from '../../../../core/auth/permissions';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';

/** Beyond this the snapshot is too old to be worth showing at all. */
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

/** One cached snapshot per scope + period, since the figures differ per combination. */
function cacheKey(scope: string[], period: Period): string {
  return `dashboard:${scope.join(',') || 'all'}:${period}`;
}

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
  imports: [
    IconComponent,
    SparklineComponent,
    DonutChartComponent,
    BarChartComponent,
    WorldMapComponent,
    HasPermissionDirective,
  ],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
})
export class OverviewComponent {
  readonly i18n = inject(I18nService);
  readonly demoData = inject(DemoDataService);
  private readonly dashboard = inject(DashboardService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

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

  private readonly db = inject(IndexedDbService);

  /** Set when the figures on screen came from the offline cache, not the service. */
  readonly staleSince = signal<Date | null>(null);

  private readonly summaryResult = toSignal(
    toObservable(
      computed(() => ({
        scope: this.scope.activeCodes(),
        period: this.period(),
        token: this.reloadToken(),
        dataRevision: this.demoData.revision(),
      })),
    ).pipe(
      switchMap(({ scope, period }) => {
        this.errorMessage.set(null);
        const key = cacheKey(scope, period);

        return this.dashboard.getSummary(scope, period).pipe(
          // A good response refreshes the offline copy for the next outage.
          tap((summary) => {
            this.staleSince.set(null);
            this.db.write(key, summary).subscribe();
          }),
          catchError((err) => {
            const message = describeError(err);
            // Falling back to cache must never hide that the live call failed —
            // the banner stays and the panel is labelled with the snapshot's age.
            return this.db.read<DashboardSummary>(key, MAX_CACHE_AGE_MS).pipe(
              map((cached) => {
                this.errorMessage.set(message);
                this.staleSince.set(cached ? cached.savedAt : null);
                return cached?.value ?? null;
              }),
            );
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
    if (!this.canNavigate(link)) return;
    this.router.navigateByUrl(link);
  }

  canNavigate(link: string): boolean {
    const permissions: Record<string, Permission> = {
      '/wms/warehouses': 'warehouse.view',
      '/wms/inventory': 'inventory.view',
      '/wms/reservations': 'reservation.view',
      '/wms/receiving': 'receiving.view',
      '/wms/putaway': 'putaway.view',
      '/wms/waves': 'wave.view',
      '/wms/picking/tasks': 'picking.view',
      '/wms/packing': 'packing.view',
      '/wms/shipping': 'shipping.view',
      '/wms/exceptions': 'exception.view',
    };
    const permission = permissions[link];
    return permission ? this.auth.can(permission) : false;
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
