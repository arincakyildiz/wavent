import { Component, computed, input, output } from '@angular/core';

/** Standard page-size choices offered across every paginated list screen. */
export const PAGE_SIZE_OPTIONS = [10, 20, 40, 60] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

/**
 * Shared pager: prev/next, "N–M of TOTAL" and a page-size select. One component so
 * every list screen picks a size the same way instead of re-deriving the arithmetic.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    <div class="pagination">
      <label class="pagination__size">
        <span class="muted small">Sayfa başına</span>
        <select
          [value]="pageSize()"
          (change)="pageSizeChange.emit(+$any($event.target).value)"
          aria-label="Sayfa başına kayıt"
        >
          @for (opt of options; track opt) {
            <option [value]="opt">{{ opt }}</option>
          }
        </select>
      </label>

      <span class="muted small pagination__range">{{ rangeLabel() }}</span>

      <span class="pagination__nav">
        <button type="button" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">‹ Önceki</button>
        <span>{{ page() }} / {{ totalPages() }}</span>
        <button type="button" [disabled]="page() >= totalPages()" (click)="pageChange.emit(page() + 1)">
          Sonraki ›
        </button>
      </span>
    </div>
  `,
  styleUrl: './pagination.component.scss',
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSize = input.required<number>();

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  readonly options = PAGE_SIZE_OPTIONS;

  readonly rangeLabel = computed(() => {
    const total = this.total();
    if (!total) return '0 kayıt';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(total, this.page() * this.pageSize());
    return `${start}–${end} / ${total}`;
  });
}
