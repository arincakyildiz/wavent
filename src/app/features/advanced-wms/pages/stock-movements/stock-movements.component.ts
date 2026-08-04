import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseString } from '../../../../shared/utils/query-params';
import { MovementType, StockMovementRow, StockMovementsService } from '../../data-access/stock-movements.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

/**
 * Movements are the densest dataset in the app, so this screen virtualises the rows
 * instead of paginating: one page holds the whole filtered set and the CDK viewport
 * renders only what is on screen.
 */
const VIRTUAL_PAGE_SIZE = 5000;
export const ROW_HEIGHT = 44;

@Component({
  selector: 'app-stock-movements',
  imports: [DecimalPipe, ScrollingModule, SortableDirective],
  templateUrl: './stock-movements.component.html',
  styleUrl: './stock-movements.component.scss',
})
export class StockMovementsComponent {
  readonly i18n = inject(I18nService);
  private readonly movementsService = inject(StockMovementsService);
  private readonly scope = inject(WarehouseScopeService);

  readonly rowHeight = ROW_HEIGHT;

  readonly search = signal('');
  readonly typeFilter = signal('all');
  readonly sort = signal<SortState | null>({ key: 'at', direction: 'desc' });

  readonly list = createListResource<StockMovementRow>(
    computed(() => ({
      scope: this.scope.activeCodes(),
      query: {
        search: this.search(),
        page: 1,
        pageSize: VIRTUAL_PAGE_SIZE,
        sort: this.sort(),
        filters: { type: this.typeFilter() },
      } satisfies ListQuery,
    })),
    (scope, query) => this.movementsService.query(scope, query),
  );

  readonly totals = toSignal(
    toObservable(computed(() => this.scope.activeCodes())).pipe(
      switchMap((scope) =>
        this.movementsService.totals(scope).pipe(
          catchError(() => of({ count: 0, inbound: 0, outbound: 0 })),
        ),
      ),
    ),
    { initialValue: { count: 0, inbound: 0, outbound: 0 } },
  );

  constructor() {
    bindQueryParams([
      { param: 'q', signal: this.search, defaultValue: '', parse: parseString },
      { param: 'type', signal: this.typeFilter, defaultValue: 'all', parse: parseString },
    ]);
  }

  onSort(state: SortState): void {
    this.sort.set(state);
  }

  typeTone(type: MovementType): string {
    const tone: Record<MovementType, string> = {
      receipt: 'tone-success',
      putaway: 'tone-info',
      pick: 'tone-warning',
      adjustment: 'tone-danger',
      'cycle-count': 'tone-violet',
      shipment: 'tone-info',
    };
    return tone[type];
  }
}
