import { AfterViewInit, Component, ElementRef, OnDestroy, inject, input, output, viewChild } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';

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
          <button class="dialog__close" type="button" (click)="dismissed.emit()" [attr.aria-label]="i18n.t('common.close')">×</button>
        </div>

        <ng-content />
      </div>
    </div>
  `,
  styleUrl: './form-dialog.component.scss',
})
export class FormDialogComponent implements AfterViewInit, OnDestroy {
  readonly i18n = inject(I18nService);
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly dismissed = output<void>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly previouslyFocused = document.activeElement as HTMLElement | null;

  ngAfterViewInit(): void {
    // Move focus into the dialog so keyboard and screen-reader users start inside it.
    const el = this.panel()?.nativeElement;
    const focusable = el?.querySelector<HTMLElement>('input, select, textarea, button');
    focusable?.focus();
  }

  ngOnDestroy(): void {
    this.previouslyFocused?.focus();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.dismissed.emit();
      return;
    }
    if (event.key === 'Tab') this.trapFocus(event);
  }

  private trapFocus(event: KeyboardEvent): void {
    const focusable = this.focusableElements();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusableElements(): HTMLElement[] {
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel()?.nativeElement.querySelectorAll<HTMLElement>(selector) ?? []);
  }
}
