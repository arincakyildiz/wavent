import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { CycleCountFormComponent } from '../../components/cycle-count-form/cycle-count-form.component';
import { CycleCountRow, CycleCountsService } from '../../data-access/cycle-counts.service';
import { VARIANCE_THRESHOLD_PCT } from '../../data-access/selectors';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-cycle-counts',
  imports: [
    DecimalPipe,
    IconComponent,
    SortableDirective,
    HasPermissionDirective,
    CycleCountFormComponent,
  ],
  templateUrl: './cycle-counts.component.html',
  styleUrl: './cycle-counts.component.scss',
})
export class CycleCountsComponent {
  private readonly cycleCountsService = inject(CycleCountsService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);

  readonly threshold = VARIANCE_THRESHOLD_PCT;
  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly page = signal(1);
  readonly sort = signal<SortState | null>({ key: 'code', direction: 'desc' });
  readonly formOpen = signal(false);

  readonly list = createListResource<CycleCountRow>(
    computed(() => ({
      scope: this.scope.activeCodes(),
      query: {
        search: this.search(),
        page: this.page(),
        pageSize: PAGE_SIZE,
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

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.list.totalPages(), p + 1));
  }

  onCreated(count: CycleCountRow): void {
    this.formOpen.set(false);
    this.audit.record({
      actionType: 'Cycle Count Scheduled',
      targetType: 'CycleCount',
      targetId: count.code,
      newValue: `${count.scopeLabel} · beklenen ${count.expectedQuantity}`,
    });
    this.notifications.success('Sayım planlandı', `${count.code} — ${count.scopeLabel}`);
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
