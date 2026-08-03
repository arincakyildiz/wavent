import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { PickRouteViewerComponent } from '../../../../shared/components/pick-route-viewer/pick-route-viewer.component';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { PickTaskRow, PickingService } from '../../data-access/picking.service';

const DEFAULT_PAGE_SIZE = 20;
const EMPTY_TOTALS = { total: 0, exceptions: 0, inProgress: 0 };

@Component({
  selector: 'app-picking-tasks',
  imports: [DecimalPipe, SortableDirective, PaginationComponent, PickRouteViewerComponent],
  templateUrl: './picking-tasks.component.html',
  styleUrl: './picking-tasks.component.scss',
})
export class PickingTasksComponent {
  private readonly pickingService = inject(PickingService);
  private readonly scope = inject(WarehouseScopeService);

  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sort = signal<SortState | null>({ key: 'code', direction: 'asc' });
  /** Task whose pick route is expanded. */
  readonly activeRow = signal<PickTaskRow | null>(null);

  readonly list = createListResource<PickTaskRow>(
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
    (scope, query) => this.pickingService.query(scope, query),
  );

  readonly totals = toSignal(
    toObservable(computed(() => this.scope.activeCodes())).pipe(
      switchMap((scope) => this.pickingService.totals(scope).pipe(catchError(() => of(EMPTY_TOTALS)))),
    ),
    { initialValue: EMPTY_TOTALS },
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

  toggleRoute(row: PickTaskRow): void {
    this.activeRow.set(this.activeRow()?.id === row.id ? null : row);
  }

  statusTone(status: PickTaskRow['status']): string {
    const tone: Record<PickTaskRow['status'], string> = {
      pending: 'tone-neutral',
      'in-progress': 'tone-info',
      exception: 'tone-danger',
      completed: 'tone-success',
    };
    return tone[status];
  }
}
