import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { describeError } from '../../../../core/api/api-error';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { LocationRow, LocationsService } from '../../data-access/locations.service';

const PAGE_SIZE = 15;

@Component({
  selector: 'app-locations',
  imports: [SortableDirective],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.scss',
})
export class LocationsComponent {
  private readonly locationsService = inject(LocationsService);
  private readonly scope = inject(WarehouseScopeService);

  readonly search = signal('');
  readonly classFilter = signal('all');
  readonly page = signal(1);
  readonly sort = signal<SortState | null>({ key: 'path', direction: 'asc' });
  readonly errorMessage = signal<string | null>(null);
  readonly reloadToken = signal(0);

  private readonly request = computed(() => ({
    scope: this.scope.activeCodes(),
    query: {
      search: this.search(),
      page: this.page(),
      pageSize: PAGE_SIZE,
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

  onSort(state: SortState): void {
    this.sort.set(state);
    this.page.set(1);
  }

  reload(): void {
    this.errorMessage.set(null);
    this.reloadToken.update((n) => n + 1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
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
    const label: Record<LocationRow['status'], string> = {
      active: 'Aktif',
      full: 'Dolu',
      blocked: 'Bloke',
      inactive: 'Pasif',
    };
    return label[status];
  }
}
