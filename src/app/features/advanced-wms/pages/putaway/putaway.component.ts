import { Component, computed, inject, signal } from '@angular/core';
import { describeError, isApiError } from '../../../../core/api/api-error';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { BarcodeInputComponent } from '../../../../shared/components/barcode-input/barcode-input.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { PutawayService, PutawaySuggestionRow } from '../../data-access/putaway.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-putaway',
  imports: [SortableDirective, PaginationComponent, HasPermissionDirective, BarcodeInputComponent],
  templateUrl: './putaway.component.html',
  styleUrl: './putaway.component.scss',
})
export class PutawayComponent {
  /** Seeded reasons are catalog keys; joined for the table cell. */
  translateAll(keys: string[]): string {
    return keys.map((k) => this.i18n.t(k)).join(' · ');
  }

  readonly i18n = inject(I18nService);
  private readonly putawayService = inject(PutawayService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);
  private readonly confirm = inject(ConfirmDialogService);

  readonly search = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sort = signal<SortState | null>({ key: 'score', direction: 'desc' });

  /** Rows accepted locally before the server confirms — cleared on success or rollback. */
  private readonly optimistic = signal<Set<string>>(new Set());
  readonly pendingId = signal<string | null>(null);

  readonly list = createListResource<PutawaySuggestionRow>(
    computed(() => ({
      scope: this.scope.activeCodes(),
      query: {
        search: this.search(),
        page: this.page(),
        pageSize: this.pageSize(),
        sort: this.sort(),
      } satisfies ListQuery,
    })),
    (scope, query) => this.putawayService.query(scope, query),
  );

  /** Server rows with the optimistic overlay applied. */
  readonly rows = computed(() => {
    const accepted = this.optimistic();
    return this.list.rows().map((r) => (accepted.has(r.id) ? { ...r, accepted: true } : r));
  });

  constructor() {
    bindQueryParams([
      { param: 'q', signal: this.search, defaultValue: '', parse: parseString },
      { param: 'page', signal: this.page, defaultValue: 1, parse: parseNumber(1) },
      { param: 'size', signal: this.pageSize, defaultValue: DEFAULT_PAGE_SIZE, parse: parseNumber(DEFAULT_PAGE_SIZE) },
    ]);
  }

  onSearch(term: string): void {
    this.search.set(term);
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

  /**
   * Scan-to-confirm: operator scans the physical location label instead of clicking
   * "Kabul Et". A code that doesn't match any pending suggestion's location is a
   * wrong-barcode exception, not a silent no-op.
   */
  onLocationScanned(code: string): void {
    const normalized = code.trim().toUpperCase();
    const match = this.rows().find(
      (r) => !r.accepted && r.suggestedLocationPath.toUpperCase() === normalized,
    );

    if (!match) {
      this.notifications.error(
        this.i18n.t('putaway.barcodeMismatch'),
        this.i18n.t('putaway.barcodeMismatchBody', { code }),
      );
      this.audit.record({
        actionType: 'Putaway Barcode Mismatch',
        targetType: 'PutawaySuggestion',
        targetId: code,
        newValue: 'no matching suggestion',
      });
      return;
    }

    this.accept(match);
  }

  accept(row: PutawaySuggestionRow): void {
    // A suggestion that breaks the capacity rule needs an explicit, justified override.
    if (!row.capacityOk) {
      this.confirm
        .ask({
          title: this.i18n.t('putaway.capacityTitle'),
          message: this.i18n.t('putaway.capacityMessage', { path: row.suggestedLocationPath }),
          confirmLabel: this.i18n.t('putaway.capacityConfirm'),
          tone: 'danger',
          requireReason: true,
          reasonLabel: this.i18n.t('common.overrideReason'),
        })
        .subscribe((result) => {
          if (result.confirmed) this.commit(row, result.reason);
        });
      return;
    }
    this.commit(row);
  }

  /**
   * Optimistic write: the row flips immediately, and any failure rolls it back and
   * offers a retry rather than leaving the UI showing something the server rejected.
   */
  private commit(row: PutawaySuggestionRow, reason?: string): void {
    this.optimistic.update((set) => new Set(set).add(row.id));
    this.pendingId.set(row.id);

    this.putawayService.accept(row.id, row.version).subscribe({
      next: (updated) => {
        this.pendingId.set(null);
        this.optimistic.update((set) => {
          const next = new Set(set);
          next.delete(row.id);
          return next;
        });

        this.audit.record({
          actionType: 'Putaway Accepted',
          targetType: 'PutawaySuggestion',
          targetId: `${updated.skuCode} → ${updated.suggestedLocationPath}`,
          oldValue: 'pending',
          newValue: 'accepted',
          reason,
        });
        this.notifications.success(
          this.i18n.t('putaway.acceptedToast'),
          `${updated.skuCode} · ${updated.suggestedLocationPath}`,
        );
        this.list.reload();
      },
      error: (err) => {
        this.pendingId.set(null);
        this.optimistic.update((set) => {
          const next = new Set(set);
          next.delete(row.id);
          return next;
        });

        const conflict = isApiError(err) && err.kind === 'conflict';
        this.notifications.error(
          conflict ? this.i18n.t('common.recordChanged') : this.i18n.t('putaway.acceptFailed'),
          describeError(err),
          conflict ? () => this.list.reload() : () => this.commit(row, reason),
        );
        if (conflict) this.list.reload();
      },
    });
  }

  scoreTone(score: number): string {
    if (score >= 90) return 'tone-success';
    if (score >= 75) return 'tone-warning';
    return 'tone-danger';
  }
}
