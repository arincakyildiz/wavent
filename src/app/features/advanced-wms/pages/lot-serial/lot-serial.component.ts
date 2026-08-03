import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { SerialFormComponent } from '../../components/serial-form/serial-form.component';
import { LotHealth, LotRow, LotSerialService, SerialIssue } from '../../data-access/lot-serial.service';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-lot-serial',
  imports: [
    DecimalPipe,
    SortableDirective,
    PaginationComponent,
    HasPermissionDirective,
    SerialFormComponent,
  ],
  templateUrl: './lot-serial.component.html',
  styleUrl: './lot-serial.component.scss',
})
export class LotSerialComponent {
  private readonly lotSerialService = inject(LotSerialService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);

  readonly formOpen = signal(false);

  readonly search = signal('');
  readonly healthFilter = signal('all');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sort = signal<SortState | null>({ key: 'daysToExpiry', direction: 'asc' });

  readonly list = createListResource<LotRow>(
    computed(() => ({
      scope: this.scope.activeCodes(),
      query: {
        search: this.search(),
        page: this.page(),
        pageSize: this.pageSize(),
        sort: this.sort(),
        filters: { health: this.healthFilter() },
      } satisfies ListQuery,
    })),
    (scope, query) => this.lotSerialService.query(scope, query),
  );

  /** §10 serial-rule breaches for the active scope, shown as a banner above the list. */
  readonly serialIssues = toSignal(
    toObservable(computed(() => this.scope.activeCodes())).pipe(
      switchMap((scope) => this.lotSerialService.serialIssues(scope).pipe(catchError(() => of([])))),
    ),
    { initialValue: [] as SerialIssue[] },
  );

  constructor() {
    bindQueryParams([
      { param: 'q', signal: this.search, defaultValue: '', parse: parseString },
      { param: 'health', signal: this.healthFilter, defaultValue: 'all', parse: parseString },
      { param: 'page', signal: this.page, defaultValue: 1, parse: parseNumber(1) },
      { param: 'size', signal: this.pageSize, defaultValue: DEFAULT_PAGE_SIZE, parse: parseNumber(DEFAULT_PAGE_SIZE) },
    ]);
  }

  onSearch(term: string): void {
    this.search.set(term);
    this.page.set(1);
  }

  onHealth(value: string): void {
    this.healthFilter.set(value);
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

  /** §10: a newly registered serial is an auditable stock event. */
  onSerialCreated(row: LotRow): void {
    this.formOpen.set(false);

    this.audit.record({
      actionType: 'Serial Registered',
      targetType: 'InventoryBalance',
      targetId: `${row.skuCode} · ${row.serial}`,
      oldValue: '—',
      newValue: `${row.warehouseCode} · ${row.locationPath}`,
    });

    this.notifications.success('Seri kaydedildi', `${row.serial} · ${row.locationPath}`);
    this.list.reload();
  }

  healthTone(health: LotHealth): string {
    const tone: Record<LotHealth, string> = {
      ok: 'tone-success',
      expiring: 'tone-warning',
      blocked: 'tone-danger',
      recalled: 'tone-danger',
    };
    return tone[health];
  }

  healthLabel(health: LotHealth): string {
    const label: Record<LotHealth, string> = {
      ok: 'Uygun',
      expiring: 'SKT Yaklaşıyor',
      blocked: 'Bloke',
      recalled: 'Süresi Geçti',
    };
    return label[health];
  }
}
