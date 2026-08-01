import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { ReservationRow, ReservationsService } from '../../data-access/reservations.service';

const PAGE_SIZE = 14;
const EMPTY_TOTALS = { total: 0, partial: 0, backorder: 0, overrides: 0 };

@Component({
  selector: 'app-reservations',
  imports: [DecimalPipe, SortableDirective],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.scss',
})
export class ReservationsComponent {
  private readonly reservationsService = inject(ReservationsService);
  private readonly scope = inject(WarehouseScopeService);

  readonly search = signal('');
  readonly filter = signal('all');
  readonly page = signal(1);
  readonly sort = signal<SortState | null>({ key: 'orderNumber', direction: 'asc' });

  readonly list = createListResource<ReservationRow>(
    computed(() => ({
      scope: this.scope.activeCodes(),
      query: {
        search: this.search(),
        page: this.page(),
        pageSize: PAGE_SIZE,
        sort: this.sort(),
        filters: { fulfilment: this.filter() },
      } satisfies ListQuery,
    })),
    (scope, query) => this.reservationsService.query(scope, query),
  );

  readonly totals = toSignal(
    toObservable(computed(() => this.scope.activeCodes())).pipe(
      switchMap((scope) =>
        this.reservationsService.totals(scope).pipe(catchError(() => of(EMPTY_TOTALS))),
      ),
    ),
    { initialValue: EMPTY_TOTALS },
  );

  constructor() {
    bindQueryParams([
      { param: 'q', signal: this.search, defaultValue: '', parse: parseString },
      { param: 'fulfil', signal: this.filter, defaultValue: 'all', parse: parseString },
      { param: 'page', signal: this.page, defaultValue: 1, parse: parseNumber(1) },
    ]);
  }

  onSearch(term: string): void {
    this.search.set(term);
    this.page.set(1);
  }

  onFilter(value: string): void {
    this.filter.set(value);
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

  fulfilmentTone(value: ReservationRow['fulfilment']): string {
    const tone: Record<ReservationRow['fulfilment'], string> = {
      full: 'tone-success',
      partial: 'tone-warning',
      backorder: 'tone-danger',
    };
    return tone[value];
  }

  fulfilmentLabel(value: ReservationRow['fulfilment']): string {
    const label: Record<ReservationRow['fulfilment'], string> = {
      full: 'Tam',
      partial: 'Kısmi',
      backorder: 'Backorder',
    };
    return label[value];
  }
}
