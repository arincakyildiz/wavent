import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ActivatableDirective } from '../../../../shared/directives/activatable.directive';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { WaveCapacityBoardComponent } from '../../../../shared/components/wave-capacity-board/wave-capacity-board.component';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { WaveFormComponent } from '../../components/wave-form/wave-form.component';
import { WaveRow, WavesService } from '../../data-access/waves.service';
import { WavePlanningStore } from '../../state/wave-planning.store';
import { I18nService } from '../../../../core/i18n/i18n.service';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-waves',
  imports: [
    IconComponent,
    SortableDirective, PaginationComponent,
    ActivatableDirective,
    HasPermissionDirective,
    WaveFormComponent,
    WaveCapacityBoardComponent,
  ],
  templateUrl: './waves.component.html',
  styleUrl: './waves.component.scss',
})
export class WavesComponent {
  readonly i18n = inject(I18nService);
  private readonly wavesService = inject(WavesService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);
  private readonly store = inject(WavePlanningStore);

  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sort = signal<SortState | null>({ key: 'name', direction: 'desc' });
  readonly formOpen = signal(false);
  readonly view = signal<'table' | 'board'>('table');

  /** The board is a planning view, so it reads the store's actionable selector. */
  readonly boardWaves = this.store.actionableWaves;

  readonly list = createListResource<WaveRow>(
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
    (scope, query) => this.wavesService.query(scope, query),
  );

  constructor() {
    // Publish each loaded page to the store so the detail screen can skip a refetch
    // and the capacity board reads the same rows the table shows.
    effect(() => {
      const rows = this.list.rows();
      if (rows.length) this.store.setWaves(rows, this.scope.activeCodes());
    });

    bindQueryParams([
      { param: 'q', signal: this.search, defaultValue: '', parse: parseString },
      { param: 'status', signal: this.statusFilter, defaultValue: 'all', parse: parseString },
      { param: 'page', signal: this.page, defaultValue: 1, parse: parseNumber(1) },
      { param: 'size', signal: this.pageSize, defaultValue: DEFAULT_PAGE_SIZE, parse: parseNumber(DEFAULT_PAGE_SIZE) },
      {
        param: 'view',
        signal: this.view,
        defaultValue: 'table' as const,
        parse: (raw) => (raw === 'board' ? 'board' : 'table'),
      },
    ]);
  }

  setView(view: 'table' | 'board'): void {
    this.view.set(view);
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

  open(id: string): void {
    this.router.navigate(['/wms/waves', id]);
  }

  onCreated(wave: WaveRow): void {
    this.formOpen.set(false);
    this.audit.record({
      actionType: 'Wave Created',
      targetType: 'Wave',
      targetId: wave.name,
      newValue: this.i18n.t('waves.auditValue', { count: wave.orderCount, warehouse: wave.warehouseCode }),
    });
    this.notifications.success(
      this.i18n.t('waves.created'),
      this.i18n.t('waves.createdBody', { name: wave.name, count: wave.orderCount }),
    );
    this.list.reload();
  }

  statusTone(status: WaveRow['status']): string {
    const tone: Record<WaveRow['status'], string> = {
      draft: 'tone-neutral',
      planned: 'tone-info',
      released: 'tone-warning',
      completed: 'tone-success',
      cancelled: 'tone-danger',
    };
    return tone[status];
  }

  capacityTone(pct: number): string {
    if (pct >= 90) return 'tone-danger';
    if (pct >= 70) return 'tone-warning';
    return 'tone-success';
  }
}
