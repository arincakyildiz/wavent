import { Component, computed, inject, signal } from '@angular/core';
import { AuditService } from '../../../../core/observability/audit.service';
import { SortableDirective } from '../../../../shared/directives/sortable.directive';
import { ListQuery, SortState } from '../../../../shared/utils/list-query';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { createListResource } from '../../../../shared/utils/list-resource';
import { bindQueryParams, parseNumber, parseString } from '../../../../shared/utils/query-params';
import { AuditEventRow, AuditLogService } from '../../data-access/audit-log.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-audit-log',
  imports: [SortableDirective, PaginationComponent],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss',
})
export class AuditLogComponent {
  readonly i18n = inject(I18nService);
  private readonly auditLogService = inject(AuditLogService);
  private readonly audit = inject(AuditService);

  readonly sessionCount = this.audit.sessionCount;

  readonly search = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
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
          pageSize: this.pageSize(),
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
}
