import { Component, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { describeError } from '../../../../core/api/api-error';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { FormDialogComponent } from '../../../../shared/components/form-dialog/form-dialog.component';
import { ASN_NUMBER_PATTERN, codePattern, LOT_CODE_PATTERN, MAX_STOCK_QUANTITY, uniqueValue } from '../../../../shared/validators/wms-validators';
import { AsnRow, ReceivingService } from '../../data-access/receiving.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

const SUPPLIERS = [
  'FreshFarm Co.',
  'Global Bottling Ltd.',
  'ScanTech Devices',
  'Nordic Frozen Foods',
  'CleanCare Supplies',
  'PackRight Materials',
  'VoltCell Energy',
];

/** Domain rule: an ASN cannot be expected in the past. */
function notInPast(control: { value: unknown }): Record<string, boolean> | null {
  if (!control.value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(String(control.value)) >= today ? null : { pastDate: true };
}

@Component({
  selector: 'app-asn-form',
  imports: [ReactiveFormsModule, FormDialogComponent],
  templateUrl: './asn-form.component.html',
  styleUrl: './asn-form.component.scss',
})
export class AsnFormComponent {
  readonly i18n = inject(I18nService);
  private readonly receivingService = inject(ReceivingService);
  private readonly scope = inject(WarehouseScopeService);

  readonly created = output<AsnRow>();
  readonly dismissed = output<void>();

  readonly suppliers = SUPPLIERS;
  readonly skus = this.receivingService.availableSkus();
  readonly warehouses = this.scope.permitted;
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly form = new FormGroup({
    number: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(8), codePattern(ASN_NUMBER_PATTERN)],
      asyncValidators: [uniqueValue((v) => this.receivingService.isNumberAvailable(v))],
      updateOn: 'blur',
    }),
    supplierName: new FormControl(SUPPLIERS[0], { nonNullable: true, validators: [Validators.required] }),
    warehouseCode: new FormControl(this.scope.permitted()[0]?.code ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    expectedDate: new FormControl(new Date().toISOString().slice(0, 10), {
      nonNullable: true,
      validators: [Validators.required, notInPast],
    }),
    skuCode: new FormControl(this.skus[0]?.code ?? '', { nonNullable: true, validators: [Validators.required] }),
    expectedQuantity: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(MAX_STOCK_QUANTITY), Validators.pattern(/^\d+$/)],
    }),
    lot: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(24), codePattern(LOT_CODE_PATTERN, 'lotPattern')] }),
  });

  readonly selectedSku = () => this.skus.find((sku) => sku.code === this.form.controls.skuCode.value);

  constructor() {
    this.form.controls.skuCode.valueChanges
      .pipe(startWith(this.form.controls.skuCode.value), takeUntilDestroyed())
      .subscribe(() => {
        const validators = this.selectedSku()?.lotTracked
          ? [Validators.required, Validators.maxLength(24)]
          : [Validators.maxLength(24)];
        this.form.controls.lot.setValidators(validators);
        this.form.controls.lot.updateValueAndValidity({ emitEvent: false });
      });
  }

  get numberControl() {
    return this.form.controls.number;
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

    this.receivingService.create(this.form.getRawValue()).subscribe({
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
