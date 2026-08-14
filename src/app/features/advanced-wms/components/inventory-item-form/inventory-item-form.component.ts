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
    locationPath: new FormControl(this.inventory.locations(this.firstWarehouse)[0]?.path ?? '', { nonNullable: true }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)] }),
    lot: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(24)] }),
  });

  constructor() {
    if (!this.form.controls.locationPath.value) this.form.controls.quantity.setValue(0);

    this.form.controls.lotTracked.valueChanges
      .pipe(startWith(this.form.controls.lotTracked.value), takeUntilDestroyed())
      .subscribe((tracked) => {
        this.form.controls.lot.setValidators(
          tracked ? [Validators.required, Validators.maxLength(24)] : [Validators.maxLength(24)],
        );
        this.form.controls.lot.updateValueAndValidity({ emitEvent: false });
      });
    this.form.controls.serialTracked.valueChanges
      .pipe(startWith(this.form.controls.serialTracked.value), takeUntilDestroyed())
      .subscribe((tracked) => {
        if (tracked) this.form.controls.quantity.setValue(0);
      });
  }

  locations(): { path: string }[] {
    return this.inventory.locations(this.form.controls.warehouseCode.value);
  }

  hasLocations(): boolean {
    return this.locations().length > 0;
  }

  onWarehouseChange(): void {
    const firstLocation = this.locations()[0]?.path ?? '';
    this.form.controls.locationPath.setValue(firstLocation);
    if (!firstLocation) this.form.controls.quantity.setValue(0);
  }

  submit(): void {
    const raw = this.form.getRawValue();
    if (raw.quantity > 0 && !raw.locationPath.trim()) {
      this.submitError.set(this.i18n.t('inventoryForm.locationRequiredForOpeningStock'));
      this.form.controls.locationPath.markAsTouched();
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);
    this.inventory.createItem(raw).subscribe({
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
