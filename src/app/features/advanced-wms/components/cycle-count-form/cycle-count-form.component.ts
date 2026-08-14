import { Component, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { describeError } from '../../../../core/api/api-error';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { FormDialogComponent } from '../../../../shared/components/form-dialog/form-dialog.component';
import { CYCLE_COUNT_CODE_PATTERN, codePattern, positiveInteger, uniqueValue } from '../../../../shared/validators/wms-validators';
import { CycleCountRow, CycleCountsService } from '../../data-access/cycle-counts.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

/** Bounds are declared here so the form enforces them and the UI can state them. */
export const CYCLE_COUNT_LIMITS = {
  codeMax: 6,
  scopeMin: 3,
  scopeMax: 60,
  quantityMin: 1,
  /** A single count sheet beyond this is a stock-take, not a cycle count. */
  quantityMax: 100_000,
} as const;

@Component({
  selector: 'app-cycle-count-form',
  imports: [ReactiveFormsModule, FormDialogComponent],
  templateUrl: './cycle-count-form.component.html',
  styleUrl: './cycle-count-form.component.scss',
})
export class CycleCountFormComponent {
  readonly i18n = inject(I18nService);
  private readonly cycleCountsService = inject(CycleCountsService);
  private readonly scope = inject(WarehouseScopeService);

  readonly created = output<CycleCountRow>();
  readonly dismissed = output<void>();

  readonly warehouses = this.scope.permitted;
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly limits = CYCLE_COUNT_LIMITS;

  readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(6), codePattern(CYCLE_COUNT_CODE_PATTERN)],
      asyncValidators: [uniqueValue((v) => this.cycleCountsService.isCodeAvailable(v))],
      updateOn: 'blur',
    }),
    warehouseCode: new FormControl(this.scope.permitted()[0]?.code ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    scopeLabel: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(60)],
    }),
    expectedQuantity: new FormControl(0, {
      nonNullable: true,
      validators: [
        Validators.required,
        positiveInteger,
        Validators.min(CYCLE_COUNT_LIMITS.quantityMin),
        Validators.max(CYCLE_COUNT_LIMITS.quantityMax),
      ],
    }),
  });

  get codeControl() {
    return this.form.controls.code;
  }

  invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.dirty || control.touched);
  }

  submit(): void {
    if (this.form.pending) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    this.cycleCountsService.create(this.form.getRawValue()).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.created.emit(created);
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitError.set(describeError(err));
      },
    });
  }
}
