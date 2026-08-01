import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { ActivatableDirective } from '../../../../shared/directives/activatable.directive';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { InventoryRow, InventoryService } from '../../data-access/inventory.service';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-inventory',
  imports: [DecimalPipe, SortableDirective, ActivatableDirective],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
})
export class InventoryComponent {
  private readonly inventoryService = inject(InventoryService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly router = inject(Router);

  readonly search = signal('');
  readonly page = signal(1);
  readonly sort = signal<SortState | null>({ key: 'skuCode', direction: 'asc' });

  readonly list = createListResource<InventoryRow>(
    computed(() => ({
      scope: this.scope.activeCodes(),
      query: {
        search: this.search(),
        page: this.page(),
        pageSize: PAGE_SIZE,
        sort: this.sort(),
      } satisfies ListQuery,
    })),
    (scope, query) => this.inventoryService.query(scope, query),
  );

  constructor() {
    bindQueryParams([
      { param: 'q', signal: this.search, defaultValue: '', parse: parseString },
      { param: 'page', signal: this.page, defaultValue: 1, parse: parseNumber(1) },
    ]);
  }

  onSearch(term: string): void {
    this.search.set(term);
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

  openDetail(skuCode: string): void {
    this.router.navigate(['/wms/inventory', skuCode]);
  }

  availabilityPct(row: InventoryRow): number {
    return row.onHand ? Math.round((row.available / row.onHand) * 100) : 0;
  }
}
