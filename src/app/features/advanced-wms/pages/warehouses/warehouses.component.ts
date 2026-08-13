import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { describeError } from '../../../../core/api/api-error';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { WarehouseFormComponent } from '../../components/warehouse-form/warehouse-form.component';
import { WarehouseSummary, WarehousesService } from '../../data-access/warehouses.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-warehouses',
  imports: [
    IconComponent,
    SortableDirective,
    HasPermissionDirective,
    WarehouseFormComponent,
    PaginationComponent,
  ],
  templateUrl: './warehouses.component.html',
  styleUrl: './warehouses.component.scss',
})
export class WarehousesComponent {
  readonly i18n = inject(I18nService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);

  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sort = signal<SortState | null>({ key: 'code', direction: 'asc' });
  readonly formOpen = signal(false);
  readonly reloadToken = signal(0);

  private readonly query = computed<ListQuery>(() => ({
    search: this.search(),
    page: this.page(),
    pageSize: this.pageSize(),
    sort: this.sort(),
    filters: { status: this.statusFilter() },
  }));

  private readonly request = computed(() => ({
    scope: this.scope.activeCodes(),
    query: this.query(),
    token: this.reloadToken(),
  }));

  private readonly result = toSignal(
    toObservable(this.request).pipe(
      switchMap(({ scope, query }) =>
        this.warehousesService.query(scope, query).pipe(
          catchError((err) => {
            this.errorMessage.set(describeError(err));
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: undefined },
  );

  readonly errorMessage = signal<string | null>(null);

  readonly rows = computed(() => this.result()?.rows ?? []);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly totalPages = computed(() => this.result()?.totalPages ?? 1);
  readonly loading = computed(() => this.result() === undefined && !this.errorMessage());

  readonly activeCount = computed(() => this.rows().filter((w) => w.isActive).length);
  readonly avgCapacity = computed(() => {
    const rows = this.rows();
    if (!rows.length) return 0;
    return Math.round(rows.reduce((s, w) => s + w.capacityUsedPct, 0) / rows.length);
  });

  constructor() {
    bindQueryParams([
      { param: 'q', signal: this.search, defaultValue: '', parse: parseString },
      { param: 'status', signal: this.statusFilter, defaultValue: 'all', parse: parseString },
      { param: 'page', signal: this.page, defaultValue: 1, parse: parseNumber(1) },
      { param: 'size', signal: this.pageSize, defaultValue: DEFAULT_PAGE_SIZE, parse: parseNumber(DEFAULT_PAGE_SIZE) },
    ]);

    // Clear a stale error once a fresh result lands.
    effect(() => {
      if (this.result()) this.errorMessage.set(null);
    });
  }

  onSearch(term: string): void {
    this.search.set(term);
    this.page.set(1);
  }

  onStatus(value: string): void {
    this.statusFilter.set(value);
    this.page.set(1);
  }

  onSort(state: SortState): void {
    this.sort.set(state);
    this.page.set(1);
  }

  reload(): void {
    this.errorMessage.set(null);
    this.reloadToken.update((n) => n + 1);
  }

  onPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  onCreated(created: WarehouseSummary): void {
    this.formOpen.set(false);
    this.scope.register({ code: created.code, name: created.name });
    this.audit.record({
      actionType: 'Warehouse Created',
      targetType: 'Warehouse',
      targetId: created.code,
      newValue: `${created.name} (${created.city})`,
    });
    this.notifications.success(this.i18n.t('warehouses.created'), `${created.code} — ${created.name}`);
    this.reload();
  }

  capacityTone(pct: number): string {
    if (pct >= 85) return 'tone-danger';
    if (pct >= 65) return 'tone-warning';
    return 'tone-success';
  }
}
