import { Component, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { describeError } from '../../../../core/api/api-error';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { FormDialogComponent } from '../../../../shared/components/form-dialog/form-dialog.component';
import { cutOffRunway, positiveInteger, uniqueValue } from '../../../../shared/validators/wms-validators';
import { db } from '../../data-access/mock-data';
import { WaveRow, WavesService } from '../../data-access/waves.service';

/** A wave needs enough runway between now and cut-off to be picked and shipped. */
const MIN_RUNWAY_MINUTES = 45;

@Component({
  selector: 'app-wave-form',
  imports: [ReactiveFormsModule, FormDialogComponent],
  templateUrl: './wave-form.component.html',
  styleUrl: './wave-form.component.scss',
})
export class WaveFormComponent {
  private readonly wavesService = inject(WavesService);
  private readonly scope = inject(WarehouseScopeService);

  readonly created = output<WaveRow>();
  readonly dismissed = output<void>();

  readonly warehouses = this.scope.permitted;
  readonly carriers = db.carriers;
  readonly zones = ['', 'A', 'B', 'C', 'F', 'HZ'];
  readonly minRunway = MIN_RUNWAY_MINUTES;

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(4)],
        asyncValidators: [uniqueValue((v) => this.wavesService.isNameAvailable(v))],
        updateOn: 'blur',
      }),
      warehouseCode: new FormControl(this.scope.permitted()[0]?.code ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      zone: new FormControl('', { nonNullable: true }),
      carrier: new FormControl(db.carriers[0], { nonNullable: true, validators: [Validators.required] }),
      cutOffTime: new FormControl('16:00', { nonNullable: true, validators: [Validators.required] }),
      minPriority: new FormControl(2, { nonNullable: true, validators: [Validators.required, positiveInteger] }),
      maxOrders: new FormControl(8, { nonNullable: true, validators: [Validators.required, positiveInteger] }),
    },
    { validators: [cutOffRunway('cutOffTime', MIN_RUNWAY_MINUTES)] },
  );

  get nameControl() {
    return this.form.controls.name;
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

    this.wavesService.create(this.form.getRawValue()).subscribe({
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
