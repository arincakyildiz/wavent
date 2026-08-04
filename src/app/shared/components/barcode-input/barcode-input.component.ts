import { Component, ElementRef, output, signal, viewChild, inject } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { I18nService } from '../../../core/i18n/i18n.service';

/** A scan gun fires very fast repeats of the same code; treat those as one scan. */
const DUPLICATE_WINDOW_MS = 800;

/**
 * Free-text input styled for barcode-scan workflows (receiving, putaway, picking).
 * A physical scanner behaves like a keyboard that types the code and hits Enter, so
 * this only needs to listen for Enter — but it also debounces the double-fire a
 * scanner produces when held on a label too long.
 */
@Component({
  selector: 'app-barcode-input',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="barcode-input">
      <app-icon name="scanLine" [size]="16" />
      <input
        #input
        type="text"
        [attr.placeholder]="placeholder() || i18n.t('barcode.placeholder')"
        maxlength="40"
        autocomplete="off"
        (keydown.enter)="submit($any($event.target).value)"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 14px;
    }

    .barcode-input {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 8px 13px;
      border-radius: 9px;
      border: 1px solid var(--border-strong);
      background: var(--surface-1);
      color: var(--text-muted);
    }

    input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      color: var(--text-primary);
      font-size: 13px;
      font-family: monospace;
      outline: none;

      &::placeholder {
        color: var(--text-muted);
        font-family: inherit;
      }
    }
  `,
})
export class BarcodeInputComponent {
  readonly i18n = inject(I18nService);
  readonly placeholder = signal('');

  /** Emits the trimmed code for every genuinely new scan (duplicates are swallowed). */
  readonly scanned = output<string>();

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('input');

  private lastCode: string | null = null;
  private lastScanAt = 0;

  submit(value: string): void {
    const code = value.trim();
    const el = this.inputRef()?.nativeElement;
    if (el) el.value = '';
    if (!code) return;

    const now = Date.now();
    if (code === this.lastCode && now - this.lastScanAt < DUPLICATE_WINDOW_MS) {
      return;
    }
    this.lastCode = code;
    this.lastScanAt = now;
    this.scanned.emit(code);
  }
}
