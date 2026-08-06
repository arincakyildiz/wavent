import { Component, effect, inject, viewChild, ElementRef } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmDialogService } from '../../../core/state/confirm-dialog.service';
import { I18nService } from '../../../core/i18n/i18n.service';

@Component({
  selector: 'app-confirm-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly i18n = inject(I18nService);
  private readonly dialogService = inject(ConfirmDialogService);

  readonly dialog = this.dialogService.dialog;

  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmBtn');
  private readonly reasonInput = viewChild<ElementRef<HTMLTextAreaElement>>('reasonInput');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private previouslyFocused: HTMLElement | null = null;

  readonly form = new FormGroup({
    reason: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const open = this.dialog();
      if (!open) {
        const previous = this.previouslyFocused;
        this.previouslyFocused = null;
        queueMicrotask(() => previous?.focus());
        return;
      }

      if (!this.previouslyFocused) {
        this.previouslyFocused = document.activeElement as HTMLElement | null;
      }

      const reason = this.form.controls.reason;
      reason.reset('');
      // Reason is only mandatory when the caller asks for a justification.
      reason.setValidators(
        open.requireReason
          ? [Validators.required, Validators.minLength(6), Validators.maxLength(300)]
          : [Validators.maxLength(300)],
      );
      reason.updateValueAndValidity();

      // Move focus into the dialog so keyboard users land in the right place.
      queueMicrotask(() => {
        const target = open.requireReason ? this.reasonInput()?.nativeElement : this.confirmButton()?.nativeElement;
        target?.focus();
      });
    });
  }

  get reasonInvalid(): boolean {
    const c = this.form.controls.reason;
    return c.invalid && (c.dirty || c.touched);
  }

  confirm(): void {
    if (this.form.invalid) {
      this.form.controls.reason.markAsTouched();
      return;
    }
    const reason = this.form.controls.reason.value.trim();
    this.dialogService.resolve({ confirmed: true, reason: reason || undefined });
  }

  cancel(): void {
    this.dialogService.resolve({ confirmed: false });
  }

  onBackdropKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cancel();
      return;
    }
    if (event.key === 'Tab') this.trapFocus(event);
  }

  private trapFocus(event: KeyboardEvent): void {
    const selector = 'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(
      this.panel()?.nativeElement.querySelectorAll<HTMLElement>(selector) ?? [],
    );
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
}
