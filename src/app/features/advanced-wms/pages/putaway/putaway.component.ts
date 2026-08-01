import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { describeError, isApiError } from '../../../../core/api/api-error';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { PutawayService, PutawaySuggestionRow } from '../../data-access/putaway.service';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-putaway',
  imports: [DecimalPipe, SortableDirective, HasPermissionDirective],
  templateUrl: './putaway.component.html',
  styleUrl: './putaway.component.scss',
})
export class PutawayComponent {
  private readonly putawayService = inject(PutawayService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);
  private readonly confirm = inject(ConfirmDialogService);

  readonly search = signal('');
  readonly page = signal(1);
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
        pageSize: PAGE_SIZE,
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

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.list.totalPages(), p + 1));
  }

  accept(row: PutawaySuggestionRow): void {
    // A suggestion that breaks the capacity rule needs an explicit, justified override.
    if (!row.capacityOk) {
      this.confirm
        .ask({
          title: 'Kapasite aşımı',
          message: `${row.suggestedLocationPath} bu miktar için yetersiz görünüyor. Yine de kabul etmek istiyor musunuz?`,
          confirmLabel: 'Gerekçeyle kabul et',
          tone: 'danger',
          requireReason: true,
          reasonLabel: 'Override gerekçesi',
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
          'Putaway kabul edildi',
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
          conflict ? 'Kayıt değişmiş' : 'Putaway kabul edilemedi',
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
