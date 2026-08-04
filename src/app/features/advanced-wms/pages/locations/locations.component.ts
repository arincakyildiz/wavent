import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { describeError } from '../../../../core/api/api-error';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { WarehouseTreeComponent } from '../../../../shared/components/warehouse-tree/warehouse-tree.component';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { LocationRow, LocationsService } from '../../data-access/locations.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

const DEFAULT_PAGE_SIZE = 20;
/** The tree needs the whole hierarchy, not the current page of it. */
const TREE_PAGE_SIZE = 500;

@Component({
  selector: 'app-locations',
  imports: [SortableDirective, PaginationComponent, WarehouseTreeComponent],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.scss',
})
export class LocationsComponent {
  readonly i18n = inject(I18nService);
  private readonly locationsService = inject(LocationsService);
  private readonly scope = inject(WarehouseScopeService);

  readonly search = signal('');
  readonly classFilter = signal('all');
  readonly view = signal<'table' | 'tree'>('table');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sort = signal<SortState | null>({ key: 'path', direction: 'asc' });
  readonly errorMessage = signal<string | null>(null);
  readonly reloadToken = signal(0);

  private readonly request = computed(() => ({
    scope: this.scope.activeCodes(),
    query: {
      search: this.search(),
      // Tree view renders the full hierarchy, so paging it would truncate branches.
      page: this.view() === 'tree' ? 1 : this.page(),
      pageSize: this.view() === 'tree' ? TREE_PAGE_SIZE : this.pageSize(),
      sort: this.sort(),
      filters: { locationClass: this.classFilter() },
    } satisfies ListQuery,
    token: this.reloadToken(),
  }));

  private readonly result = toSignal(
    toObservable(this.request).pipe(
      switchMap(({ scope, query }) =>
        this.locationsService.query(scope, query).pipe(
          catchError((err) => {
            this.errorMessage.set(describeError(err));
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: undefined },
  );

  readonly rows = computed(() => this.result()?.rows ?? []);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly totalPages = computed(() => this.result()?.totalPages ?? 1);
  readonly loading = computed(() => this.result() === undefined && !this.errorMessage());

  constructor() {
    bindQueryParams([
      { param: 'q', signal: this.search, defaultValue: '', parse: parseString },
      { param: 'class', signal: this.classFilter, defaultValue: 'all', parse: parseString },
      { param: 'page', signal: this.page, defaultValue: 1, parse: parseNumber(1) },
      { param: 'size', signal: this.pageSize, defaultValue: DEFAULT_PAGE_SIZE, parse: parseNumber(DEFAULT_PAGE_SIZE) },
      {
        param: 'view',
        signal: this.view,
        defaultValue: 'table' as const,
        parse: (raw) => (raw === 'tree' ? 'tree' : 'table'),
      },
    ]);

    effect(() => {
      if (this.result()) this.errorMessage.set(null);
    });
  }

  onSearch(term: string): void {
    this.search.set(term);
    this.page.set(1);
  }

  onClass(value: string): void {
    this.classFilter.set(value);
    this.page.set(1);
  }

  setView(view: 'table' | 'tree'): void {
    this.view.set(view);
    this.page.set(1);
  }

  onSort(state: SortState): void {
    this.sort.set(state);
    this.page.set(1);
  }

  reload(): void {
    this.errorMessage.set(null);
    this.reloadToken.update((n) => n + 1);
  }

  onPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  capacityTone(row: LocationRow): string {
    if (row.capacityPct >= 90) return 'tone-danger';
    if (row.capacityPct >= 65) return 'tone-warning';
    return 'tone-success';
  }

  statusTone(status: LocationRow['status']): string {
    const tone: Record<LocationRow['status'], string> = {
      active: 'tone-success',
      full: 'tone-warning',
      blocked: 'tone-danger',
      inactive: 'tone-neutral',
    };
    return tone[status];
  }

  statusLabel(status: LocationRow['status']): string {
    return this.i18n.t(`status.${status}`);
  }
}
