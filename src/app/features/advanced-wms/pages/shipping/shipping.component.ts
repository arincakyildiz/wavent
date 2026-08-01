import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { ShipmentRow, ShippingService } from '../../data-access/shipping.service';

const PAGE_SIZE = 14;

@Component({
  selector: 'app-shipping',
  imports: [DecimalPipe, SortableDirective],
  templateUrl: './shipping.component.html',
  styleUrl: './shipping.component.scss',
})
export class ShippingComponent {
  private readonly shippingService = inject(ShippingService);
  private readonly scope = inject(WarehouseScopeService);

  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly page = signal(1);
  readonly sort = signal<SortState | null>({ key: 'code', direction: 'desc' });

  readonly list = createListResource<ShipmentRow>(
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
    (scope, query) => this.shippingService.query(scope, query),
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

  statusTone(status: ShipmentRow['status']): string {
    const tone: Record<ShipmentRow['status'], string> = {
      staged: 'tone-neutral',
      loading: 'tone-warning',
      'in-transit': 'tone-info',
      delivered: 'tone-success',
      exception: 'tone-danger',
    };
    return tone[status];
  }
}
