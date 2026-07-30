import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ShipmentStatus } from '../models/entities';

export interface ShipmentRow {
  id: string;
  code: string;
  carrier: string;
  door: string;
  packageCount: number;
  status: ShipmentStatus;
  progressPct: number;
  closedAt?: string;
}

const MOCK_SHIPMENTS: ShipmentRow[] = [
  { id: 'sh-1', code: 'SHP-7821', carrier: 'DHL Express', door: 'D-04', packageCount: 12, status: 'in-transit', progressPct: 75 },
  { id: 'sh-2', code: 'SHP-7820', carrier: 'Maersk', door: 'D-02', packageCount: 30, status: 'in-transit', progressPct: 60 },
  { id: 'sh-3', code: 'SHP-7819', carrier: 'FedEx', door: 'D-01', packageCount: 8, status: 'loading', progressPct: 100 },
  { id: 'sh-4', code: 'SHP-7818', carrier: 'UPS', door: 'D-03', packageCount: 5, status: 'delivered', progressPct: 100, closedAt: '2026-07-29 18:20' },
  { id: 'sh-5', code: 'SHP-7817', carrier: 'Aramex', door: 'D-05', packageCount: 3, status: 'staged', progressPct: 25 },
  { id: 'sh-6', code: 'SHP-7816', carrier: 'DHL Express', door: 'D-01', packageCount: 6, status: 'exception', progressPct: 40 },
];

@Injectable({ providedIn: 'root' })
export class ShippingService {
  private readonly api = inject(MockApiService);

  list(): Observable<ShipmentRow[]> {
    return this.api.simulate(MOCK_SHIPMENTS, { delayMs: 350 });
  }
}
