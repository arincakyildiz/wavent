import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';

export interface ReservationRow {
  id: string;
  orderNumber: string;
  sku: string;
  lot?: string;
  locationPath: string;
  quantity: number;
  isPartial: boolean;
  isBackorder: boolean;
  overrideReason?: string;
  strategy: 'FEFO' | 'FIFO';
}

const MOCK_RESERVATIONS: ReservationRow[] = [
  { id: 'al-1', orderNumber: 'SO-10581', sku: 'SKU-1001', lot: 'L-24081', locationPath: 'A/01/01', quantity: 1200, isPartial: false, isBackorder: false, strategy: 'FEFO' },
  { id: 'al-2', orderNumber: 'SO-10582', sku: 'SKU-1004', lot: 'L-24070', locationPath: 'C/01/02', quantity: 400, isPartial: true, isBackorder: false, strategy: 'FEFO' },
  { id: 'al-3', orderNumber: 'SO-10583', sku: 'SKU-1002', locationPath: 'A/03/02', quantity: 900, isPartial: false, isBackorder: false, strategy: 'FIFO' },
  { id: 'al-4', orderNumber: 'SO-10584', sku: 'SKU-1006', lot: 'L-24055', locationPath: 'A/02/01', quantity: 0, isPartial: true, isBackorder: true, strategy: 'FEFO' },
  { id: 'al-5', orderNumber: 'SO-10585', sku: 'SKU-1001', lot: 'L-24060', locationPath: 'B/01/01', quantity: 300, isPartial: false, isBackorder: false, overrideReason: 'Müşteri talebiyle daha yeni lot kullanıldı', strategy: 'FEFO' },
  { id: 'al-6', orderNumber: 'SO-10586', sku: 'SKU-1008', locationPath: 'HZ/01/01', quantity: 60, isPartial: false, isBackorder: false, strategy: 'FIFO' },
];

@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private readonly api = inject(MockApiService);

  list(): Observable<ReservationRow[]> {
    return this.api.simulate(MOCK_RESERVATIONS, { delayMs: 350 });
  }
}
