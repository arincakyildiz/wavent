import { Directive, HostBinding, HostListener, computed, input, output } from '@angular/core';
import { SortState, nextSort } from '../utils/list-query';

/**
 * Makes a `<th>` sortable and keyboard operable:
 *
 *   <th appSortable="code" [sort]="sort()" (sortChange)="onSort($event)">Kod</th>
 *
 * Sets aria-sort so assistive tech announces the current order, and renders the
 * indicator via a CSS class rather than extra markup.
 */
@Directive({
  selector: '[appSortable]',
  standalone: true,
})
export class SortableDirective {
  readonly appSortable = input.required<string>();
  readonly sort = input<SortState | null>(null);
  readonly sortChange = output<SortState>();

  private readonly active = computed(() => this.sort()?.key === this.appSortable());

  @HostBinding('class.sortable') readonly isSortable = true;
  @HostBinding('attr.tabindex') readonly tabindex = 0;
  @HostBinding('attr.role') readonly role = 'columnheader';

  @HostBinding('class.sortable--active') get activeClass(): boolean {
    return this.active();
  }

  @HostBinding('class.sortable--desc') get descClass(): boolean {
    return this.active() && this.sort()?.direction === 'desc';
  }

  @HostBinding('attr.aria-sort') get ariaSort(): string {
    if (!this.active()) return 'none';
    return this.sort()!.direction === 'asc' ? 'ascending' : 'descending';
  }

  @HostListener('click')
  onClick(): void {
    this.emit();
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.emit();
    }
  }

  private emit(): void {
    this.sortChange.emit(nextSort(this.sort(), this.appSortable()));
  }
}
