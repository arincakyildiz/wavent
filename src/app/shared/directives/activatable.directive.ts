import { Directive, HostBinding, HostListener, output } from '@angular/core';

/**
 * Turns a non-interactive element (typically a `<tr>`) into a keyboard-reachable
 * activator:
 *
 *   <tr appActivatable (activated)="open(row.id)">
 *
 * Table rows carrying a click handler are mouse-only by default; this adds the
 * tabindex, the link role and Enter/Space handling that keyboard users need.
 */
@Directive({
  selector: '[appActivatable]',
  standalone: true,
})
export class ActivatableDirective {
  readonly activated = output<void>();

  @HostBinding('attr.tabindex') readonly tabindex = 0;
  @HostBinding('attr.role') readonly role = 'link';
  @HostBinding('class.clickable') readonly clickable = true;

  @HostListener('click')
  onClick(): void {
    this.activated.emit();
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      // Space would otherwise scroll the page while the row is focused.
      event.preventDefault();
      this.activated.emit();
    }
  }
}
