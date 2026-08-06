import { Component, computed, inject, signal } from '@angular/core';
import { describeError, isApiError } from '../../../../core/api/api-error';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ScaleInputComponent } from '../../../../shared/components/scale-input/scale-input.component';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { PackageRow, PackingService } from '../../data-access/packing.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-packing',
  imports: [
    SortableDirective,
    PaginationComponent,
    HasPermissionDirective,
    ScaleInputComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './packing.component.html',
  styleUrl: './packing.component.scss',
})
export class PackingComponent {
  readonly i18n = inject(I18nService);
  private readonly packingService = inject(PackingService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);
  private readonly confirm = inject(ConfirmDialogService);

  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sort = signal<SortState | null>({ key: 'code', direction: 'asc' });
  readonly pendingId = signal<string | null>(null);

  /** Package currently on the bench scale. */
  readonly weighingRow = signal<PackageRow | null>(null);
  readonly splitRow = signal<PackageRow | null>(null);
  readonly splitForm = new FormGroup({
    firstPackageItems: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
  });

  readonly list = createListResource<PackageRow>(
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
    (scope, query) => this.packingService.query(scope, query),
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

  /* ---------- Bench scale (§2 device simulation) ---------- */

  toggleScale(row: PackageRow): void {
    this.weighingRow.set(this.weighingRow()?.id === row.id ? null : row);
  }

  /**
   * Commits a settled scale reading. The recorded expectation is left alone, so a
   * reading outside tolerance moves the package to weight-hold and needs the
   * supervisor approval below — the scale cannot wave its own deviation through.
   */
  onWeighed(row: PackageRow, weightKg: number): void {
    this.pendingId.set(row.id);

    this.packingService.recordWeight(row.id, row.version, weightKg).subscribe({
      next: (updated) => {
        this.pendingId.set(null);
        this.weighingRow.set(null);

        this.audit.record({
          actionType: 'Package Weighed',
          targetType: 'Package',
          targetId: updated.code,
          oldValue: `${row.weightKg} kg`,
          newValue: `${updated.weightKg} kg`,
        });

        if (updated.weightOk) {
          this.notifications.success(this.i18n.t('packing.weightSaved'), `${updated.code} · ${updated.weightKg} kg`);
        } else {
          this.notifications.warning(
            this.i18n.t('packing.outOfToleranceTitle'),
            this.i18n.t('packing.outOfToleranceBody', {
          code: updated.code,
          deviation: `${updated.deviationKg > 0 ? '+' : ''}${updated.deviationKg}`,
        }),
          );
        }

        this.list.reload();
      },
      error: (err) => {
        this.pendingId.set(null);
        const conflict = isApiError(err) && err.kind === 'conflict';
        this.notifications.error(
          conflict ? this.i18n.t('packing.packageChanged') : this.i18n.t('packing.weightSaveFailed'),
          describeError(err),
          () => this.list.reload(),
        );
        if (conflict) {
          this.weighingRow.set(null);
          this.list.reload();
        }
      },
    });
  }

  /** §10: an out-of-tolerance package cannot proceed without a justified approval. */
  approveWeight(row: PackageRow): void {
    this.confirm
      .ask({
        title: this.i18n.t('packing.approvalTitle'),
        message: this.i18n.t('packing.approvalMessage', {
        code: row.code,
        weight: row.weightKg,
        expected: row.expectedWeightKg,
        tolerance: row.toleranceKg,
        deviation: row.deviationKg,
      }),
        confirmLabel: this.i18n.t('packing.approvalConfirm'),
        tone: 'danger',
        requireReason: true,
        reasonLabel: this.i18n.t('packing.approvalReason'),
        reasonPlaceholder: this.i18n.t('packing.approvalPlaceholder'),
      })
      .subscribe((result) => {
        if (result.confirmed) this.commitApproval(row, result.reason ?? '');
      });
  }

  private commitApproval(row: PackageRow, reason: string): void {
    this.pendingId.set(row.id);

    this.packingService.approveWeight(row.id, row.version, reason).subscribe({
      next: (updated) => {
        this.pendingId.set(null);
        this.audit.record({
          actionType: 'Weight Tolerance Override',
          targetType: 'Package',
          targetId: updated.code,
          oldValue: `${row.expectedWeightKg} kg ±${row.toleranceKg}`,
          newValue: this.i18n.t('packing.approvedAudit', { weight: updated.weightKg }),
          reason,
        });
        this.notifications.success(
        this.i18n.t('packing.approvedToast'),
        this.i18n.t('packing.sealed', { code: updated.code }),
      );
        this.list.reload();
      },
      error: (err) => {
        this.pendingId.set(null);
        const conflict = isApiError(err) && err.kind === 'conflict';
        this.notifications.error(
          conflict ? this.i18n.t('packing.packageChanged') : this.i18n.t('packing.approvalFailed'),
          describeError(err),
          conflict ? () => this.list.reload() : () => this.commitApproval(row, reason),
        );
        if (conflict) this.list.reload();
      },
    });
  }

  verifyContent(row: PackageRow): void {
    this.pendingId.set(row.id);
    this.packingService.verifyContent(row.id, row.version).subscribe({
      next: (updated) => {
        this.pendingId.set(null);
        this.audit.record({ actionType: 'Package Content Verified', targetType: 'Package', targetId: updated.code, oldValue: 'pending', newValue: 'verified' });
        this.notifications.success(this.i18n.t('packing.contentVerifiedToast'), updated.code);
        this.list.reload();
      },
      error: (err) => {
        this.pendingId.set(null);
        this.notifications.error(this.i18n.t('packing.contentVerifyFailed'), describeError(err), () => this.list.reload());
      },
    });
  }

  openSplit(row: PackageRow): void {
    this.splitRow.set(row);
    this.splitForm.setValue({ firstPackageItems: Math.max(1, Math.floor(row.itemCount / 2)) });
  }

  saveSplit(): void {
    const row = this.splitRow();
    if (!row || this.splitForm.invalid) return;
    const quantity = this.splitForm.getRawValue().firstPackageItems;
    this.pendingId.set(row.id);
    this.packingService.split(row.id, row.version, quantity).subscribe({
      next: ([first, second]) => {
        this.pendingId.set(null);
        this.splitRow.set(null);
        this.audit.record({
          actionType: 'Package Split',
          targetType: 'Package',
          targetId: row.code,
          oldValue: row.itemCount,
          newValue: `${first.code}:${first.itemCount}, ${second.code}:${second.itemCount}`,
        });
        this.notifications.success(this.i18n.t('packing.splitToast'), `${first.code} + ${second.code}`);
        this.list.reload();
      },
      error: (err) => {
        this.pendingId.set(null);
        this.notifications.error(this.i18n.t('packing.splitFailed'), describeError(err), () => this.list.reload());
      },
    });
  }

  statusTone(status: PackageRow['status']): string {
    const tone: Record<PackageRow['status'], string> = {
      open: 'tone-neutral',
      sealed: 'tone-success',
      'weight-hold': 'tone-danger',
      shipped: 'tone-info',
    };
    return tone[status];
  }
}
