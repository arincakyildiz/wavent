import { Component, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { describeError } from '../../../../core/api/api-error';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { codePattern, MAX_STOCK_QUANTITY, SALES_ORDER_NUMBER_PATTERN } from '../../../../shared/validators/wms-validators';
import { FormDialogComponent } from '../../../../shared/components/form-dialog/form-dialog.component';
import { ReservationRow, ReservationsService } from '../../data-access/reservations.service';

@Component({ selector: 'app-sales-order-form', imports: [ReactiveFormsModule, FormDialogComponent], templateUrl: './sales-order-form.component.html' })
export class SalesOrderFormComponent {
  readonly i18n = inject(I18nService);
  private readonly reservations = inject(ReservationsService);
  private readonly scope = inject(WarehouseScopeService);
  readonly created = output<ReservationRow>();
  readonly dismissed = output<void>();
  readonly warehouses = this.scope.permitted;
  readonly options = this.reservations.orderOptions();
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly form = new FormGroup({
    number: new FormControl('', { nonNullable: true, validators: [Validators.required, codePattern(SALES_ORDER_NUMBER_PATTERN)] }),
    warehouseCode: new FormControl(this.warehouses()[0]?.code ?? '', { nonNullable: true, validators: [Validators.required] }),
    priority: new FormControl(2, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(5)] }),
    carrier: new FormControl(this.options.carriers[0] ?? '', { nonNullable: true, validators: [Validators.required] }),
    route: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    cutOffTime: new FormControl('17:00', { nonNullable: true, validators: [Validators.required] }),
    skuCode: new FormControl(this.options.skus[0]?.code ?? '', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(MAX_STOCK_QUANTITY), Validators.pattern(/^\d+$/)] }),
  });
  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true); this.submitError.set(null);
    this.reservations.createOrder(this.form.getRawValue()).subscribe({
      next: (row) => { this.submitting.set(false); this.created.emit(row); },
      error: (error) => { this.submitting.set(false); this.submitError.set(describeError(error)); },
    });
  }
}
