import { Component, computed, inject, signal } from '@angular/core';
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
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { AsnFormComponent } from '../../components/asn-form/asn-form.component';
import { AsnRow, ReceivingService } from '../../data-access/receiving.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-receiving',
  imports: [
    IconComponent,
    SortableDirective, PaginationComponent,
    ActivatableDirective,
    HasPermissionDirective,
    AsnFormComponent,
  ],
  templateUrl: './receiving.component.html',
  styleUrl: './receiving.component.scss',
})
export class ReceivingComponent {
  readonly i18n = inject(I18nService);
  private readonly receivingService = inject(ReceivingService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);

  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sort = signal<SortState | null>({ key: 'expectedDate', direction: 'desc' });
  readonly formOpen = signal(false);

  readonly list = createListResource<AsnRow>(
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
    (scope, query) => this.receivingService.query(scope, query),
  );

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

  open(id: string): void {
    this.router.navigate(['/wms/receiving', id]);
  }

  onCreated(asn: AsnRow): void {
    this.formOpen.set(false);
    this.search.set(asn.number);
    this.page.set(1);
    this.audit.record({
      actionType: 'ASN Created',
      targetType: 'ASN',
      targetId: asn.number,
      newValue: `${asn.supplierName} · ${asn.expectedDate}`,
    });
    this.notifications.success(this.i18n.t('receiving.created'), `${asn.number} — ${asn.supplierName}`);
    this.list.reload();
  }

  statusTone(status: AsnRow['status']): string {
    const tone: Record<AsnRow['status'], string> = {
      expected: 'tone-neutral',
      arrived: 'tone-info',
      receiving: 'tone-warning',
      closed: 'tone-success',
      cancelled: 'tone-danger',
    };
    return tone[status];
  }
}
