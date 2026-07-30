import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';

export type MovementType = 'receipt' | 'putaway' | 'pick' | 'adjustment' | 'cycle-count' | 'shipment';

export interface StockMovementRow {
  id: string;
  date: string;
  sku: string;
  lot?: string;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  type: MovementType;
  reasonCode: string;
  performedBy: string;
}

const MOCK_MOVEMENTS: StockMovementRow[] = [
  { id: 'mv-1', date: '2026-07-29 18:00', sku: 'SKU-1001', lot: 'L-24081', quantity: -1200, fromLocation: 'A/01/01', type: 'shipment', reasonCode: 'SHP-7821', performedBy: 'Michael Brown' },
  { id: 'mv-2', date: '2026-07-29 15:20', sku: 'SKU-1001', lot: 'L-24081', quantity: -1200, fromLocation: 'A/01/01', toLocation: 'D/01/01', type: 'pick', reasonCode: 'PK-2815', performedBy: 'John Doe' },
  { id: 'mv-3', date: '2026-07-28 09:40', sku: 'SKU-1001', lot: 'L-24081', quantity: 3200, toLocation: 'A/01/01', type: 'putaway', reasonCode: 'ASN-4887', performedBy: 'System' },
  { id: 'mv-4', date: '2026-07-28 09:12', sku: 'SKU-1001', lot: 'L-24081', quantity: 3200, toLocation: 'STAGE-IN', type: 'receipt', reasonCode: 'ASN-4887', performedBy: 'Sarah Lee' },
  { id: 'mv-5', date: '2026-07-27 14:03', sku: 'SKU-1006', lot: 'L-24090', quantity: -450, fromLocation: 'A/02/01', type: 'pick', reasonCode: 'PK-2790', performedBy: 'Jessica Park' },
  { id: 'mv-6', date: '2026-07-27 08:40', sku: 'SKU-1001', lot: 'L-24060', quantity: -30, fromLocation: 'B/01/01', type: 'cycle-count', reasonCode: 'CC-118', performedBy: 'Jessica Park' },
  { id: 'mv-7', date: '2026-07-26 17:22', sku: 'SKU-1004', lot: 'L-24070', quantity: 1800, toLocation: 'C/01/02', type: 'putaway', reasonCode: 'ASN-4880', performedBy: 'System' },
  { id: 'mv-8', date: '2026-07-26 11:10', sku: 'SKU-1008', quantity: -40, fromLocation: 'HZ/01/01', type: 'adjustment', reasonCode: 'DMG-014', performedBy: 'Michael Brown' },
  { id: 'mv-9', date: '2026-07-25 16:45', sku: 'SKU-1002', quantity: 950, toLocation: 'A/03/02', type: 'receipt', reasonCode: 'ASN-4879', performedBy: 'Sarah Lee' },
  { id: 'mv-10', date: '2026-07-25 09:05', sku: 'SKU-1007', quantity: -1500, fromLocation: 'A/03/02', type: 'shipment', reasonCode: 'SHP-7818', performedBy: 'Michael Brown' },
];

@Injectable({ providedIn: 'root' })
export class StockMovementsService {
  private readonly api = inject(MockApiService);

  list(): Observable<StockMovementRow[]> {
    return this.api.simulate(MOCK_MOVEMENTS, { delayMs: 350 });
  }
}
