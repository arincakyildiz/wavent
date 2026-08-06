import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { PickRouteViewerComponent } from '../../../../shared/components/pick-route-viewer/pick-route-viewer.component';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseString } from '../../../../shared/utils/query-params';
import { PICK_OPERATORS, PickTaskRow, PickingService } from '../../data-access/picking.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { NotificationService } from '../../../../core/observability/notification.service';
import { AuditService } from '../../../../core/observability/audit.service';
import { describeError } from '../../../../core/api/api-error';
import { ScrollingModule } from '@angular/cdk/scrolling';

const VIRTUAL_PAGE_SIZE = 5000;
const ROW_HEIGHT = 48;
const EMPTY_TOTALS = { total: 0, exceptions: 0, inProgress: 0 };

@Component({
  selector: 'app-picking-tasks',
  imports: [SortableDirective, PickRouteViewerComponent, ReactiveFormsModule, HasPermissionDirective, ScrollingModule],
  templateUrl: './picking-tasks.component.html',
  styleUrl: './picking-tasks.component.scss',
})
export class PickingTasksComponent {
  readonly i18n = inject(I18nService);
  private readonly pickingService = inject(PickingService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);

  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly rowHeight = ROW_HEIGHT;
  readonly sort = signal<SortState | null>({ key: 'code', direction: 'asc' });
  /** Task whose pick route is expanded. */
  readonly activeRow = signal<PickTaskRow | null>(null);
  readonly operators = PICK_OPERATORS;
  readonly saving = signal(false);
  readonly taskForm = new FormGroup({
    operator: new FormControl(PICK_OPERATORS[0], { nonNullable: true, validators: [Validators.required] }),
    barcode: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(40)] }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    issueType: new FormControl<'short-pick' | 'damage'>('short-pick', { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.minLength(6), Validators.maxLength(240)] }),
  });

  readonly list = createListResource<PickTaskRow>(
    computed(() => ({
      scope: this.scope.activeCodes(),
      query: {
        search: this.search(),
        page: 1,
        pageSize: VIRTUAL_PAGE_SIZE,
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
    ]);
  }

  onSearch(term: string): void {
    this.search.set(term);
  }

  onStatus(value: string): void {
    this.statusFilter.set(value);
  }

  onSort(state: SortState): void {
    this.sort.set(state);
  }

  toggleRoute(row: PickTaskRow): void {
    const next = this.activeRow()?.id === row.id ? null : row;
    this.activeRow.set(next);
    if (next) {
      this.taskForm.patchValue({
        operator: next.assignedTo ?? PICK_OPERATORS[0],
        barcode: next.expectedBarcode,
        quantity: Math.max(1, next.reservedQuantity - next.pickedQuantity),
        reason: '',
      });
    }
  }

  assign(row: PickTaskRow): void {
    this.runAction(
      row,
      this.pickingService.assign(row.id, row.version, this.taskForm.getRawValue().operator),
      'Pick Task Assigned',
      this.i18n.t('picking.assignedToast'),
    );
  }

  recordPick(row: PickTaskRow): void {
    const value = this.taskForm.getRawValue();
    this.runAction(
      row,
      this.pickingService.recordPick(row.id, row.version, value.barcode, value.quantity),
      'Pick Quantity Recorded',
      this.i18n.t('picking.pickSavedToast'),
    );
  }

  reportIssue(row: PickTaskRow): void {
    const value = this.taskForm.getRawValue();
    if (value.reason.trim().length < 6) {
      this.taskForm.controls.reason.markAsTouched();
      return;
    }
    this.runAction(
      row,
      this.pickingService.reportException(row.id, row.version, value.issueType, value.reason),
      value.issueType === 'damage' ? 'Pick Damage Reported' : 'Short Pick Reported',
      this.i18n.t('picking.exceptionOpenedToast'),
      value.reason,
    );
  }

  private runAction(
    row: PickTaskRow,
    request: ReturnType<PickingService['assign']>,
    actionType: string,
    title: string,
    reason?: string,
  ): void {
    this.saving.set(true);
    request.subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.activeRow.set(updated);
        this.audit.record({
          actionType,
          targetType: 'PickTask',
          targetId: updated.code,
          oldValue: `${row.pickedQuantity}/${row.reservedQuantity} · ${row.status}`,
          newValue: `${updated.pickedQuantity}/${updated.reservedQuantity} · ${updated.status}`,
          reason,
        });
        this.notifications.success(title, updated.code);
        this.list.reload();
      },
      error: (err) => {
        this.saving.set(false);
        this.notifications.error(this.i18n.t('picking.operationFailed'), describeError(err), () => this.list.reload());
        this.list.reload();
      },
    });
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
