import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { describeError } from '../../../../core/api/api-error';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ShipmentPackageRow, ShipmentRow, ShippingService } from '../../data-access/shipping.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-shipping-detail',
  imports: [DecimalPipe, IconComponent],
  templateUrl: './shipping-detail.component.html',
  styleUrl: './shipping-detail.component.scss',
})
export class ShippingDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shippingService = inject(ShippingService);

  readonly state = signal<LoadState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly shipment = signal<ShipmentRow | undefined>(undefined);
  readonly packages = signal<ShipmentPackageRow[]>([]);

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

    this.shippingService.getById(this.id).subscribe({
      next: (shipment) => {
        this.shipment.set(shipment);
        this.shippingService.getPackages(this.id).subscribe((pkgs) => this.packages.set(pkgs));
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
