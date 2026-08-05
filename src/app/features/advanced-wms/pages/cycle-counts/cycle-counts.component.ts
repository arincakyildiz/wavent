import { Component, computed, inject, signal } from '@angular/core';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { CycleCountFormComponent } from '../../components/cycle-count-form/cycle-count-form.component';
import { CycleCountRow, CycleCountsService } from '../../data-access/cycle-counts.service';
import { VARIANCE_THRESHOLD_PCT } from '../../data-access/selectors';
import { I18nService } from '../../../../core/i18n/i18n.service';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-cycle-counts',
  imports: [
    IconComponent,
    SortableDirective, PaginationComponent,
    HasPermissionDirective,
    CycleCountFormComponent,
  ],
  templateUrl: './cycle-counts.component.html',
  styleUrl: './cycle-counts.component.scss',
})
export class CycleCountsComponent {
  readonly i18n = inject(I18nService);
  private readonly cycleCountsService = inject(CycleCountsService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);

  readonly threshold = VARIANCE_THRESHOLD_PCT;
  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sort = signal<SortState | null>({ key: 'code', direction: 'desc' });
  readonly formOpen = signal(false);

  readonly list = createListResource<CycleCountRow>(
    computed(() => ({
      scope: this.scope.activeCodes(),
      query: {
        search: this.search(),
        page: this.page(),
        pageSize: this.pageSize(),
        sort: this.sort(),
        filters: { status: this.statusFilter() },
      } satisfies ListQuery,
    })),
    (scope, query) => this.cycleCountsService.query(scope, query),
  );

  readonly secondCountNeeded = computed(() => this.list.rows().filter((r) => r.requiresSecondCount).length);

  constructor() {
    bindQueryParams([
      { param: 'q', signal: this.search, defaultValue: '', parse: parseString },
      { param: 'status', signal: this.statusFilter, defaultValue: 'all', parse: parseString },
      { param: 'page', signal: this.page, defaultValue: 1, parse: parseNumber(1) },
      { param: 'size', signal: this.pageSize, defaultValue: DEFAULT_PAGE_SIZE, parse: parseNumber(DEFAULT_PAGE_SIZE) },
    ]);
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

  onPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  onCreated(count: CycleCountRow): void {
    this.formOpen.set(false);
    this.audit.record({
      actionType: 'Cycle Count Scheduled',
      targetType: 'CycleCount',
      targetId: count.code,
      newValue: this.i18n.t('cycleCounts.auditValue', { scope: count.scopeLabel, qty: count.expectedQuantity }),
    });
    this.notifications.success(this.i18n.t('cycleCounts.scheduled'), `${count.code} — ${count.scopeLabel}`);
    this.list.reload();
  }

  statusTone(status: CycleCountRow['status']): string {
    const tone: Record<CycleCountRow['status'], string> = {
      scheduled: 'tone-neutral',
      'in-progress': 'tone-info',
      'variance-review': 'tone-warning',
      closed: 'tone-success',
    };
    return tone[status];
  }
}
