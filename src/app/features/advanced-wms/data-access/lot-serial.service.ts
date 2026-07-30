import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';

export type LotHealth = 'ok' | 'expiring' | 'blocked' | 'recalled';

export interface LotSerialRow {
  id: string;
  lot: string;
  serial?: string;
  sku: string;
  skuName: string;
  warehouseCode: string
  quantity: number;
  expiryDate?: string;
  daysToExpiry?: number;
  health: LotHealth;
}

const MOCK_ROWS: LotSerialRow[] = [
  { id: 'ls-1', lot: 'L-24081', sku: 'SKU-1001', skuName: 'Organic Almond Milk 1L', warehouseCode: 'NYC-01', quantity: 5000, expiryDate: '2026-08-14', daysToExpiry: 15, health: 'expiring' },
  { id: 'ls-2', lot: 'L-24075', sku: 'SKU-1001', skuName: 'Organic Almond Milk 1L', warehouseCode: 'IST-01', quantity: 3000, expiryDate: '2026-09-02', daysToExpiry: 34, health: 'ok' },
  { id: 'ls-3', lot: 'L-24060', sku: 'SKU-1001', skuName: 'Organic Almond Milk 1L', warehouseCode: 'NYC-01', quantity: 420, expiryDate: '2026-07-20', daysToExpiry: -10, health: 'recalled' },
  { id: 'ls-4', lot: 'L-24070', sku: 'SKU-1004', skuName: 'Frozen Chicken Breast 5kg', warehouseCode: 'IST-01', quantity: 2200, expiryDate: '2026-08-02', daysToExpiry: 3, health: 'expiring' },
  { id: 'ls-5', lot: 'L-24090', sku: 'SKU-1006', skuName: 'Hand Sanitizer 500ml', warehouseCode: 'DXB-01', quantity: 9800, expiryDate: '2027-01-10', daysToExpiry: 164, health: 'ok' },
  { id: 'ls-6', lot: 'L-24055', sku: 'SKU-1006', skuName: 'Hand Sanitizer 500ml', warehouseCode: 'AMS-01', quantity: 400, expiryDate: '2026-08-09', daysToExpiry: 10, health: 'blocked' },
  { id: 'ls-7', lot: 'L-24101', serial: 'SN-88412', sku: 'SKU-1003', skuName: 'Wireless Barcode Scanner', warehouseCode: 'NYC-01', quantity: 1, health: 'ok' },
  { id: 'ls-8', lot: 'L-24101', serial: 'SN-88413', sku: 'SKU-1003', skuName: 'Wireless Barcode Scanner', warehouseCode: 'NYC-01', quantity: 1, health: 'ok' },
  { id: 'ls-9', lot: 'L-24102', serial: 'SN-90021', sku: 'SKU-1008', skuName: 'Lithium Battery Pack 10Ah', warehouseCode: 'DXB-01', quantity: 1, expiryDate: '2028-03-01', daysToExpiry: 580, health: 'ok' },
  { id: 'ls-10', lot: 'L-24102', serial: 'SN-90022', sku: 'SKU-1008', skuName: 'Lithium Battery Pack 10Ah', warehouseCode: 'DXB-01', quantity: 1, expiryDate: '2028-03-01', daysToExpiry: 580, health: 'blocked' },
];

@Injectable({ providedIn: 'root' })
export class LotSerialService {
  private readonly api = inject(MockApiService);

  list(): Observable<LotSerialRow[]> {
    return this.api.simulate(MOCK_ROWS, { delayMs: 350 });
  }
}
