import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { describeError } from '../../../../core/api/api-error';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ShipmentPackageRow, ShipmentRow, ShippingService } from '../../data-access/shipping.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { forkJoin } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { NotificationService } from '../../../../core/observability/notification.service';
import { AuditService } from '../../../../core/observability/audit.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-shipping-detail',
  imports: [IconComponent, ReactiveFormsModule, HasPermissionDirective],
  templateUrl: './shipping-detail.component.html',
  styleUrl: './shipping-detail.component.scss',
})
export class ShippingDetailComponent {
  readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shippingService = inject(ShippingService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);
  private readonly confirm = inject(ConfirmDialogService);

  readonly state = signal<LoadState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly shipment = signal<ShipmentRow | undefined>(undefined);
  readonly packages = signal<ShipmentPackageRow[]>([]);
  readonly saving = signal(false);
  readonly doorForm = new FormGroup({
    door: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^D-\d{2}$/)] }),
  });

  readonly totalWeight = computed(() => this.packages().reduce((s, p) => s + p.weightKg, 0));
  readonly verifiedCount = computed(() => this.packages().filter((p) => p.contentVerified).length);
  readonly toleranceIssues = computed(
    () => this.packages().filter((p) => Math.abs(p.weightKg - p.expectedWeightKg) > p.toleranceKg).length,
  );

  private id = '';

  constructor() {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set(null);

    forkJoin({
      shipment: this.shippingService.getById(this.id),
      packages: this.shippingService.getPackages(this.id),
    }).subscribe({
      next: ({ shipment, packages }) => {
        this.shipment.set(shipment);
        this.packages.set(packages);
        this.doorForm.setValue({ door: shipment.door });
        this.state.set('success');
      },
      error: (err) => {
        this.errorMessage.set(describeError(err));
        this.state.set('error');
      },
    });
  }

  back(): void {
    this.router.navigate(['/wms/shipping']);
  }

  /** The browser's own print pipeline is the PDF export — "Save as PDF" in the print dialog. */
  downloadPdf(): void {
    window.print();
  }

  saveDoor(): void {
    const shipment = this.shipment();
    if (!shipment || this.doorForm.invalid) return;
    this.saving.set(true);
    const door = this.doorForm.getRawValue().door;
    this.shippingService.assignDoor(shipment.id, shipment.version, door).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.shipment.set(updated);
        this.audit.record({ actionType: 'Shipment Door Assigned', targetType: 'Shipment', targetId: updated.code, oldValue: shipment.door, newValue: updated.door });
        this.notifications.success(this.i18n.t('shippingDetail.doorSaved'), updated.door);
      },
      error: (err) => this.operationFailed(err),
    });
  }

  loadNext(): void {
    const shipment = this.shipment();
    if (!shipment) return;
    this.saving.set(true);
    this.shippingService.loadNextPackage(shipment.id, shipment.version).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.shipment.set(updated);
        const loadedCode = updated.loadedPackageCodes.at(-1) ?? '';
        this.audit.record({ actionType: 'Package Loaded', targetType: 'Shipment', targetId: updated.code, newValue: loadedCode });
        this.notifications.success(this.i18n.t('shippingDetail.packageLoaded'), loadedCode);
      },
      error: (err) => this.operationFailed(err),
    });
  }

  closeShipment(): void {
    const shipment = this.shipment();
    if (!shipment) return;
    this.confirm.ask({
      title: this.i18n.t('shippingDetail.closeTitle', { code: shipment.code }),
      message: this.i18n.t('shippingDetail.closeMessage'),
      confirmLabel: this.i18n.t('shippingDetail.closeConfirm'),
      requireReason: true,
      reasonLabel: this.i18n.t('shippingDetail.closeReason'),
    }).subscribe((result) => {
      if (!result.confirmed) return;
      this.saving.set(true);
      this.shippingService.close(shipment.id, shipment.version, result.reason ?? '').subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.shipment.set(updated);
          this.packages.update((rows) => rows.map((row) => ({ ...row, status: 'shipped' })));
          this.audit.record({ actionType: 'Shipment Closed', targetType: 'Shipment', targetId: updated.code, oldValue: shipment.status, newValue: updated.status, reason: result.reason });
          this.notifications.success(this.i18n.t('shippingDetail.closedToast'), updated.code);
        },
        error: (err) => this.operationFailed(err),
      });
    });
  }

  private operationFailed(err: unknown): void {
    this.saving.set(false);
    this.notifications.error(this.i18n.t('shippingDetail.operationFailed'), describeError(err), () => this.load());
  }

  statusTone(status: ShipmentRow['status']): string {
    const tone: Record<ShipmentRow['status'], string> = {
      staged: 'tone-neutral',
      loading: 'tone-warning',
      'in-transit': 'tone-info',
      delivered: 'tone-success',
      exception: 'tone-danger',
    };
    return tone[status];
  }

  packageTone(status: ShipmentPackageRow['status']): string {
    const tone: Record<ShipmentPackageRow['status'], string> = {
      open: 'tone-neutral',
      sealed: 'tone-info',
      'weight-hold': 'tone-danger',
      shipped: 'tone-success',
    };
    return tone[status] ?? 'tone-neutral';
  }
}
