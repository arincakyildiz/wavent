import { Component, ElementRef, output, input, viewChild, AfterViewInit } from '@angular/core';

/**
 * Presentational shell for create/edit forms: backdrop, focus trap entry point and
 * Escape handling. The form itself is projected, so each feature owns its own
 * FormGroup and validation while the modal behaviour lives in one place.
 */
@Component({
  selector: 'app-form-dialog',
  standalone: true,
  template: `
    <div class="backdrop" (keydown)="onKeydown($event)" tabindex="-1">
      <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="title()" #panel>
        <div class="dialog__head">
          <div>
            <h2 class="dialog__title">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="dialog__subtitle">{{ subtitle() }}</p>
            }
          </div>
          <button class="dialog__close" type="button" (click)="dismissed.emit()" aria-label="Kapat">×</button>
        </div>

        <ng-content />
      </div>
    </div>
  `,
  styleUrl: './form-dialog.component.scss',
})
export class FormDialogComponent implements AfterViewInit {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly dismissed = output<void>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  ngAfterViewInit(): void {
    // Move focus into the dialog so keyboard and screen-reader users start inside it.
    const el = this.panel()?.nativeElement;
    const focusable = el?.querySelector<HTMLElement>('input, select, textarea, button');
    focusable?.focus();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.dismissed.emit();
  }
}
