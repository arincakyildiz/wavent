import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AuditService } from '../../../../core/observability/audit.service';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { AuditEventRow, AuditLogService } from '../../data-access/audit-log.service';

const PAGE_SIZE = 14;

@Component({
  selector: 'app-audit-log',
  imports: [DecimalPipe, SortableDirective],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss',
})
export class AuditLogComponent {
  private readonly auditLogService = inject(AuditLogService);
  private readonly audit = inject(AuditService);

  readonly sessionCount = this.audit.sessionCount;

  readonly search = signal('');
  readonly page = signal(1);
  readonly sort = signal<SortState | null>({ key: 'date', direction: 'desc' });

  readonly list = createListResource<AuditEventRow>(
    // Depends on sessionCount so a newly recorded action refreshes the table.
    computed(() => {
      this.audit.sessionCount();
      return {
        scope: [],
        query: {
          search: this.search(),
          page: this.page(),
          pageSize: PAGE_SIZE,
          sort: this.sort(),
        } satisfies ListQuery,
      };
    }),
    (_scope, query) => this.auditLogService.query(query),
  );

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
}
