import { Component, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { describeError } from '../../../../core/api/api-error';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { FormDialogComponent } from '../../../../shared/components/form-dialog/form-dialog.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { InventoryRow, InventoryService } from '../../data-access/inventory.service';

@Component({
  selector: 'app-inventory-item-form',
  imports: [ReactiveFormsModule, FormDialogComponent],
  templateUrl: './inventory-item-form.component.html',
})
export class InventoryItemFormComponent {
  readonly i18n = inject(I18nService);
  private readonly inventory = inject(InventoryService);
  private readonly scope = inject(WarehouseScopeService);

  readonly created = output<InventoryRow>();
  readonly dismissed = output<void>();
  readonly warehouses = this.scope.permitted;
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  private readonly firstWarehouse = this.warehouses()[0]?.code ?? '';
  readonly form = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^SKU-[A-Z0-9]{3,8}$/)] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3), Validators.maxLength(80)] }),
    uom: new FormControl('ADET', { nonNullable: true, validators: [Validators.required, Validators.maxLength(10)] }),
    weightKg: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.001)] }),
    volumeM3: new FormControl(0.01, { nonNullable: true, validators: [Validators.required, Validators.min(0.0001)] }),
    lotTracked: new FormControl(false, { nonNullable: true }),
    serialTracked: new FormControl(false, { nonNullable: true }),
    storageClass: new FormControl<'ambient' | 'chilled' | 'frozen' | 'hazmat'>('ambient', { nonNullable: true }),
    warehouseCode: new FormControl(this.firstWarehouse, { nonNullable: true, validators: [Validators.required] }),
    locationPath: new FormControl(this.inventory.locations(this.firstWarehouse)[0]?.path ?? '', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)] }),
    lot: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(24)] }),
  });

  constructor() {
    this.form.controls.lotTracked.valueChanges
      .pipe(startWith(this.form.controls.lotTracked.value), takeUntilDestroyed())
      .subscribe((tracked) => {
        this.form.controls.lot.setValidators(
          tracked ? [Validators.required, Validators.maxLength(24)] : [Validators.maxLength(24)],
        );
        this.form.controls.lot.updateValueAndValidity({ emitEvent: false });
      });
  }

  locations(): { path: string }[] {
    return this.inventory.locations(this.form.controls.warehouseCode.value);
  }

  onWarehouseChange(): void {
    this.form.controls.locationPath.setValue(this.locations()[0]?.path ?? '');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);
    this.inventory.createItem(this.form.getRawValue()).subscribe({
      next: (row) => {
        this.submitting.set(false);
        this.created.emit(row);
      },
      error: (error) => {
        this.submitting.set(false);
        this.submitError.set(describeError(error));
      },
    });
  }
}
