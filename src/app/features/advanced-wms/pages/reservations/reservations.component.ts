import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { describeError, isApiError } from '../../../../core/api/api-error';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { AllocationBreakdownComponent } from '../../../../shared/components/allocation-breakdown/allocation-breakdown.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { LotCandidate, ReservationRow, ReservationsService } from '../../data-access/reservations.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

const DEFAULT_PAGE_SIZE = 20;
const EMPTY_TOTALS = { total: 0, partial: 0, backorder: 0, overrides: 0 };

@Component({
  selector: 'app-reservations',
  imports: [
    DecimalPipe,
    SortableDirective,
    PaginationComponent,
    HasPermissionDirective,
    AllocationBreakdownComponent,
  ],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.scss',
})
export class ReservationsComponent {
  readonly i18n = inject(I18nService);
  private readonly reservationsService = inject(ReservationsService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);

  /** Row whose lot alternatives are currently expanded. */
  readonly activeRow = signal<ReservationRow | null>(null);
  readonly candidates = signal<LotCandidate[]>([]);
  readonly candidatesLoading = signal(false);
  readonly overriding = signal(false);

  readonly search = signal('');
  readonly filter = signal('all');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sort = signal<SortState | null>({ key: 'orderNumber', direction: 'asc' });

  readonly list = createListResource<ReservationRow>(
    computed(() => ({
      scope: this.scope.activeCodes(),
      query: {
        search: this.search(),
        page: this.page(),
        pageSize: this.pageSize(),
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
      { param: 'size', signal: this.pageSize, defaultValue: DEFAULT_PAGE_SIZE, parse: parseNumber(DEFAULT_PAGE_SIZE) },
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

  onPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
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
      partial: this.i18n.t('reservations.partial'),
      backorder: 'Backorder',
    };
    return label[value];
  }

  /* ---------- Manual lot override (§4 / §11) ---------- */

  toggleCandidates(row: ReservationRow): void {
    if (this.activeRow()?.id === row.id) {
      this.activeRow.set(null);
      return;
    }

    this.activeRow.set(row);
    this.candidates.set([]);
    this.candidatesLoading.set(true);

    this.reservationsService.candidates(row.id).subscribe({
      next: (rows) => {
        this.candidates.set(rows);
        this.candidatesLoading.set(false);
      },
      error: () => {
        this.candidatesLoading.set(false);
        this.notifications.error(this.i18n.t('reservations.altLoadFailed'));
      },
    });
  }

  /** Re-allocating away from FEFO always needs a recorded justification (§10). */
  chooseCandidate(candidate: LotCandidate): void {
    const row = this.activeRow();
    if (!row || this.overriding()) return;

    const breaksFefo = !!candidate.fefoViolationLot;
    this.confirm
      .ask({
        title: this.i18n.t('reservations.moveTitle', { order: row.orderNumber }),
        message: breaksFefo
          ? this.i18n.t('reservations.moveFefo', {
            target: candidate.lot ?? candidate.locationPath,
            lot: candidate.fefoViolationLot ?? '',
          })
          : this.i18n.t('reservations.movePlain', {
            qty: row.quantity,
            target: candidate.lot ?? candidate.locationPath,
          }),
        confirmLabel: this.i18n.t('reservations.moveConfirm'),
        tone: breaksFefo ? 'danger' : 'default',
        requireReason: true,
        reasonLabel: this.i18n.t('common.overrideReason'),
      })
      .subscribe((result) => {
        if (result.confirmed) this.commitOverride(row, candidate, result.reason ?? '');
      });
  }

  private commitOverride(row: ReservationRow, candidate: LotCandidate, reason: string): void {
    this.overriding.set(true);

    this.reservationsService
      .override(row.id, row.version, { lot: candidate.lot, locationPath: candidate.locationPath }, reason)
      .subscribe({
        next: (updated) => {
          this.overriding.set(false);
          this.activeRow.set(null);

          this.audit.record({
            actionType: 'Reservation Overridden',
            targetType: 'Allocation',
            targetId: `${row.orderNumber} · ${row.sku}`,
            oldValue: row.lot ?? row.locationPath,
            newValue: updated.lot ?? updated.locationPath,
            reason,
          });

          this.notifications.success(
            this.i18n.t('reservations.moved'),
            this.i18n.t('reservations.movedBody', {
          sku: row.sku,
          target: updated.lot ?? updated.locationPath,
        }),
          );
          this.list.reload();
        },
        error: (err) => {
          this.overriding.set(false);
          const conflict = isApiError(err) && err.kind === 'conflict';

          this.notifications.error(
            conflict ? this.i18n.t('reservations.conflict') : this.i18n.t('reservations.moveFailed'),
            describeError(err),
            () => this.list.reload(),
          );

          // A conflict means our view is stale — reload so the retry sees live data.
          if (conflict) {
            this.activeRow.set(null);
            this.list.reload();
          }
        },
      });
  }
}
