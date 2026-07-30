import { Component, inject, signal } from '@angular/core';
import { ShipmentRow, ShippingService } from '../../data-access/shipping.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-shipping',
  imports: [],
  templateUrl: './shipping.component.html',
  styleUrl: './shipping.component.scss',
})
export class ShippingComponent {
  private readonly shippingService = inject(ShippingService);

  readonly state = signal<LoadState>('loading');
  readonly shipments = signal<ShipmentRow[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.shippingService.list().subscribe({
      next: (rows) => {
        this.shipments.set(rows);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
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
}
