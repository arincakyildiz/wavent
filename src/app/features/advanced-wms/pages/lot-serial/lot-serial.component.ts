import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { LotHealth, LotRow, LotSerialService, SerialIssue } from '../../data-access/lot-serial.service';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-lot-serial',
  imports: [DecimalPipe, SortableDirective, PaginationComponent],
  templateUrl: './lot-serial.component.html',
  styleUrl: './lot-serial.component.scss',
})
export class LotSerialComponent {
  private readonly lotSerialService = inject(LotSerialService);
  private readonly scope = inject(WarehouseScopeService);

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
