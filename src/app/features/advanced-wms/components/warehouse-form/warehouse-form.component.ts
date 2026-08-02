import { Component, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { describeError } from '../../../../core/api/api-error';
import { FormDialogComponent } from '../../../../shared/components/form-dialog/form-dialog.component';
import {
  codePattern,
  operatingHoursRange,
  uniqueValue,
} from '../../../../shared/validators/wms-validators';
import { WarehouseSummary, WarehousesService } from '../../data-access/warehouses.service';

const TIMEZONES = [
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/Amsterdam',
  'Europe/Istanbul',
  'Asia/Dubai',
];

@Component({
  selector: 'app-warehouse-form',
  imports: [ReactiveFormsModule, FormDialogComponent],
  templateUrl: './warehouse-form.component.html',
  styleUrl: './warehouse-form.component.scss',
})
export class WarehouseFormComponent {
  private readonly warehousesService = inject(WarehousesService);

  readonly created = output<WarehouseSummary>();
  readonly dismissed = output<void>();

  readonly timezones = TIMEZONES;
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly form = new FormGroup(
    {
      code: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(7), codePattern(/^[A-Z]{2,4}-\d{2}$/)],
        asyncValidators: [uniqueValue((v) => this.warehousesService.isCodeAvailable(v))],
        updateOn: 'blur',
      }),
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(60)],
      }),
      city: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(40)],
      }),
      country: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(40)],
      }),
      timezone: new FormControl(TIMEZONES[0], { nonNullable: true, validators: [Validators.required] }),
      open: new FormControl('06:00', { nonNullable: true, validators: [Validators.required] }),
      close: new FormControl('22:00', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: [operatingHoursRange()] },
  );

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

    this.warehousesService.create(this.form.getRawValue()).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.created.emit(created);
      },
      error: (err) => {
        this.submitting.set(false);
        // Server-side conflict wins over the (possibly stale) async validator.
        this.submitError.set(describeError(err));
      },
    });
  }
}
