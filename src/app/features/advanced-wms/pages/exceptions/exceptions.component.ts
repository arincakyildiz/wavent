import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { describeError, isApiError } from '../../../../core/api/api-error';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { ExceptionWorkbenchComponent } from '../../../../shared/components/exception-workbench/exception-workbench.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import {
  EXCEPTION_OWNERS,
  ExceptionEvidence,
  ExceptionRow,
  ExceptionsService,
} from '../../data-access/exceptions.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

const DEFAULT_PAGE_SIZE = 20;
const EMPTY_TOTALS = { open: 0, investigating: 0, resolved: 0, critical: 0 };

@Component({
  selector: 'app-exceptions',
  imports: [
    DecimalPipe,
    SortableDirective,
    PaginationComponent,
    HasPermissionDirective,
    ExceptionWorkbenchComponent,
  ],
  templateUrl: './exceptions.component.html',
  styleUrl: './exceptions.component.scss',
})
export class ExceptionsComponent {
  readonly i18n = inject(I18nService);
  private readonly exceptionsService = inject(ExceptionsService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);
  private readonly confirm = inject(ConfirmDialogService);

  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sort = signal<SortState | null>({ key: 'createdAt', direction: 'desc' });
  readonly pendingId = signal<string | null>(null);

  /** Exception whose workbench is expanded. */
  readonly activeRow = signal<ExceptionRow | null>(null);
  readonly evidence = signal<ExceptionEvidence[]>([]);
  readonly evidenceLoading = signal(false);
  readonly owners = EXCEPTION_OWNERS;

  readonly list = createListResource<ExceptionRow>(
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
    (scope, query) => this.exceptionsService.query(scope, query),
  );

  readonly totals = toSignal(
    toObservable(computed(() => this.scope.activeCodes())).pipe(
      switchMap((scope) => this.exceptionsService.totals(scope).pipe(catchError(() => of(EMPTY_TOTALS)))),
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

  /** Opens the case view and pulls the evidence behind the exception. */
  toggleWorkbench(row: ExceptionRow): void {
    if (this.activeRow()?.id === row.id) {
      this.activeRow.set(null);
      return;
    }

    this.activeRow.set(row);
    this.evidence.set([]);
    this.evidenceLoading.set(true);

    this.exceptionsService.evidence(row.id).subscribe({
      next: (items) => {
        this.evidence.set(items);
        this.evidenceLoading.set(false);
      },
      error: () => {
        this.evidenceLoading.set(false);
        this.notifications.error(this.i18n.t('exceptions.evidenceLoadFailed'));
      },
    });
  }

  /** Handing an exception over is version-guarded and audited like any other write. */
  reassign(row: ExceptionRow, owner: string): void {
    this.pendingId.set(row.id);

    this.exceptionsService.reassign(row.id, row.version, owner).subscribe({
      next: (updated) => {
        this.pendingId.set(null);
        this.activeRow.set(null);

        this.audit.record({
          actionType: 'Exception Reassigned',
          targetType: updated.referenceType,
          targetId: updated.referenceId,
          oldValue: row.owner ?? '—',
          newValue: owner,
        });

        this.notifications.success(this.i18n.t('exceptions.reassigned'), `${updated.referenceId} → ${owner}`);
        this.list.reload();
      },
      error: (err) => {
        this.pendingId.set(null);
        const conflict = isApiError(err) && err.kind === 'conflict';
        this.notifications.error(
          conflict ? this.i18n.t('common.recordChanged') : this.i18n.t('exceptions.assignFailed'),
          describeError(err),
          () => this.list.reload(),
        );
        if (conflict) {
          this.activeRow.set(null);
          this.list.reload();
        }
      },
    });
  }

  /** Resolution always captures a written decision — the dialog enforces it. */
  resolve(row: ExceptionRow): void {
    this.confirm
      .ask({
        title: this.i18n.t('exceptions.resolveTitle'),
        message: this.i18n.t('exceptions.resolveMessage', {
        type: row.type,
        refType: row.referenceType,
        refId: row.referenceId,
      }),
        confirmLabel: this.i18n.t('exceptions.resolveConfirm'),
        requireReason: true,
        reasonLabel: this.i18n.t('exceptions.resolveReason'),
      })
      .subscribe((result) => {
        if (result.confirmed) this.commitResolve(row, result.reason ?? '');
      });
  }

  private commitResolve(row: ExceptionRow, note: string): void {
    this.pendingId.set(row.id);

    this.exceptionsService.resolve(row.id, row.version, note).subscribe({
      next: (updated) => {
        this.pendingId.set(null);
        this.audit.record({
          actionType: 'Exception Resolved',
          targetType: updated.referenceType,
          targetId: updated.referenceId,
          oldValue: row.status,
          newValue: 'resolved',
          reason: note,
        });
        this.notifications.success(this.i18n.t('exceptions.resolvedToast'), `${updated.type} · ${updated.referenceId}`);
        this.list.reload();
      },
      error: (err) => {
        this.pendingId.set(null);
        const conflict = isApiError(err) && err.kind === 'conflict';
        this.notifications.error(
          conflict ? this.i18n.t('common.recordChanged') : this.i18n.t('exceptions.resolveFailed'),
          describeError(err),
          conflict ? () => this.list.reload() : () => this.commitResolve(row, note),
        );
        if (conflict) this.list.reload();
      },
    });
  }

  severityTone(severity: ExceptionRow['severity']): string {
    const tone: Record<ExceptionRow['severity'], string> = {
      low: 'tone-neutral',
      medium: 'tone-warning',
      high: 'tone-danger',
      critical: 'tone-danger',
    };
    return tone[severity];
  }

  statusTone(status: ExceptionRow['status']): string {
    const tone: Record<ExceptionRow['status'], string> = {
      open: 'tone-danger',
      investigating: 'tone-warning',
      resolved: 'tone-success',
    };
    return tone[status];
  }
}
