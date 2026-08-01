import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ActivatableDirective } from '../../../../shared/directives/activatable.directive';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { WaveFormComponent } from '../../components/wave-form/wave-form.component';
import { WaveRow, WavesService } from '../../data-access/waves.service';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-waves',
  imports: [
    DecimalPipe,
    IconComponent,
    SortableDirective,
    ActivatableDirective,
    HasPermissionDirective,
    WaveFormComponent,
  ],
  templateUrl: './waves.component.html',
  styleUrl: './waves.component.scss',
})
export class WavesComponent {
  private readonly wavesService = inject(WavesService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);

  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly page = signal(1);
  readonly sort = signal<SortState | null>({ key: 'name', direction: 'desc' });
  readonly formOpen = signal(false);

  readonly list = createListResource<WaveRow>(
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
    (scope, query) => this.wavesService.query(scope, query),
  );

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

  open(id: string): void {
    this.router.navigate(['/wms/waves', id]);
  }

  onCreated(wave: WaveRow): void {
    this.formOpen.set(false);
    this.audit.record({
      actionType: 'Wave Created',
      targetType: 'Wave',
      targetId: wave.name,
      newValue: `${wave.orderCount} sipariş · ${wave.warehouseCode}`,
    });
    this.notifications.success('Dalga oluşturuldu', `${wave.name} — ${wave.orderCount} sipariş`);
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
