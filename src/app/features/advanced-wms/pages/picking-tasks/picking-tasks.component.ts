import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { PickTaskRow, PickingService } from '../../data-access/picking.service';

const PAGE_SIZE = 14;
const EMPTY_TOTALS = { total: 0, exceptions: 0, inProgress: 0 };

@Component({
  selector: 'app-picking-tasks',
  imports: [DecimalPipe, SortableDirective],
  templateUrl: './picking-tasks.component.html',
  styleUrl: './picking-tasks.component.scss',
})
export class PickingTasksComponent {
  private readonly pickingService = inject(PickingService);
  private readonly scope = inject(WarehouseScopeService);

  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly page = signal(1);
  readonly sort = signal<SortState | null>({ key: 'code', direction: 'asc' });

  readonly list = createListResource<PickTaskRow>(
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
