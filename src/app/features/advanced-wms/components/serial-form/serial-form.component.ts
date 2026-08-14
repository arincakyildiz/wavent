import { Component, computed, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { describeError } from '../../../../core/api/api-error';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { FormDialogComponent } from '../../../../shared/components/form-dialog/form-dialog.component';
import { codePattern, LOT_CODE_PATTERN, SERIAL_NUMBER_PATTERN, uniqueValue } from '../../../../shared/validators/wms-validators';
import { LocationsService } from '../../data-access/locations.service';
import { LotRow, LotSerialService } from '../../data-access/lot-serial.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

/**
 * Registers one serialised unit (§10). The serial is checked for uniqueness twice:
 * asynchronously while typing, and again server-side on submit — the second check is
 * the one that actually enforces the rule, since the first can only see a snapshot.
 */
@Component({
  selector: 'app-serial-form',
  imports: [ReactiveFormsModule, FormDialogComponent],
  templateUrl: './serial-form.component.html',
  styleUrl: './serial-form.component.scss',
})
export class SerialFormComponent {
  readonly i18n = inject(I18nService);
  private readonly lotSerialService = inject(LotSerialService);
  private readonly locationsService = inject(LocationsService);
  private readonly scope = inject(WarehouseScopeService);

  readonly created = output<LotRow>();
  readonly dismissed = output<void>();

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly skus = this.lotSerialService.serialTrackedSkus();
  readonly warehouses = computed(() => this.scope.permitted());
  readonly locationPaths = signal<string[]>([]);

  /**
   * The SKU the uniqueness check runs against. Held outside the FormGroup because the
   * async validator is part of the group's own initialiser — reading the control from
   * there would make the group's type depend on itself.
   */
  private readonly selectedSku = signal(this.skus[0]?.code ?? '');

  readonly form = new FormGroup({
    skuCode: new FormControl(this.skus[0]?.code ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    serial: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(40),
        codePattern(SERIAL_NUMBER_PATTERN, 'serialPattern'),
      ],
      asyncValidators: [
        uniqueValue((value) => this.lotSerialService.isSerialAvailable(this.selectedSku(), value)),
      ],
      updateOn: 'blur',
    }),
    lot: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(24), codePattern(LOT_CODE_PATTERN, 'lotPattern')] }),
    warehouseCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    locationPath: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  constructor() {
    const first = this.warehouses()[0]?.code ?? '';
    this.form.controls.warehouseCode.setValue(first);
    if (first) this.loadLocations(first);
  }

  get serialControl() {
    return this.form.controls.serial;
  }

  invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.dirty || control.touched);
  }

  /** Bins belong to a warehouse, so the location list follows the warehouse choice. */
  onWarehouse(code: string): void {
    this.form.controls.warehouseCode.setValue(code);
    this.form.controls.locationPath.setValue('');
    this.loadLocations(code);
  }

  /** Changing the SKU invalidates a uniqueness answer given for the previous one. */
  onSku(code: string): void {
    this.form.controls.skuCode.setValue(code);
    this.selectedSku.set(code);
    this.serialControl.updateValueAndValidity();
  }

  submit(): void {
    if (this.form.pending) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    const raw = this.form.getRawValue();
    this.lotSerialService
      .registerSerial({
        skuCode: raw.skuCode,
        serial: raw.serial.trim(),
        lot: raw.lot.trim() || undefined,
        warehouseCode: raw.warehouseCode,
        locationPath: raw.locationPath,
      })
      .subscribe({
        next: (row) => {
          this.submitting.set(false);
          this.created.emit(row);
        },
        error: (err) => {
          this.submitting.set(false);
          // A server conflict beats the async validator's older answer.
          this.submitError.set(describeError(err));
        },
      });
  }

  private loadLocations(warehouseCode: string): void {
    this.locationsService
      .query([warehouseCode], { page: 1, pageSize: 200, search: '', sort: null, filters: {} })
      .subscribe({
        next: (result) => {
          const bins = result.rows.filter((l) => l.type === 'bin').map((l) => l.path);
          this.locationPaths.set(bins);
          if (bins.length && !this.form.controls.locationPath.value) {
            this.form.controls.locationPath.setValue(bins[0]);
          }
        },
        error: () => this.locationPaths.set([]),
      });
  }
}
