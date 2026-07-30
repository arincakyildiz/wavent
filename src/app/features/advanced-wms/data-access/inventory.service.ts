import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { StockStatus } from '../models/entities';

export interface InventoryRow {
  sku: string;
  name: string;
  totalOnHand: number;
  available: number;
  reserved: number;
  quarantine: number;
  damaged: number;
  lotTracked: boolean;
  serialTracked: boolean;
  nearestExpiry?: string;
}

export interface InventoryLotRow {
  lot: string;
  locationPath: string;
  warehouseCode: string;
  quantity: number;
  status: StockStatus;
  expiryDate?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: string;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  runningBalance: number;
  reasonCode: string;
}

const MOCK_INVENTORY: InventoryRow[] = [
  { sku: 'SKU-1001', name: 'Organic Almond Milk 1L', totalOnHand: 8420, available: 6200, reserved: 1800, quarantine: 300, damaged: 120, lotTracked: true, serialTracked: false, nearestExpiry: '2026-08-14' },
  { sku: 'SKU-1002', name: 'Stainless Steel Water Bottle', totalOnHand: 5210, available: 4600, reserved: 610, quarantine: 0, damaged: 0, lotTracked: false, serialTracked: false },
  { sku: 'SKU-1003', name: 'Wireless Barcode Scanner', totalOnHand: 640, available: 420, reserved: 180, quarantine: 20, damaged: 20, lotTracked: false, serialTracked: true },
  { sku: 'SKU-1004', name: 'Frozen Chicken Breast 5kg', totalOnHand: 3120, available: 2200, reserved: 700, quarantine: 220, damaged: 0, lotTracked: true, serialTracked: false, nearestExpiry: '2026-08-02' },
  { sku: 'SKU-1005', name: 'Industrial Shelving Unit', totalOnHand: 240, available: 180, reserved: 60, quarantine: 0, damaged: 0, lotTracked: false, serialTracked: true },
  { sku: 'SKU-1006', name: 'Hand Sanitizer 500ml', totalOnHand: 12400, available: 9800, reserved: 2100, quarantine: 400, damaged: 100, lotTracked: true, serialTracked: false, nearestExpiry: '2027-01-10' },
  { sku: 'SKU-1007', name: 'Corrugated Shipping Box M', totalOnHand: 20500, available: 19000, reserved: 1500, quarantine: 0, damaged: 0, lotTracked: false, serialTracked: false },
  { sku: 'SKU-1008', name: 'Lithium Battery Pack 10Ah', totalOnHand: 980, available: 640, reserved: 240, quarantine: 60, damaged: 40, lotTracked: true, serialTracked: true, nearestExpiry: '2028-03-01' },
];

const MOCK_LOTS: Record<string, InventoryLotRow[]> = {
  'SKU-1001': [
    { lot: 'L-24081', locationPath: 'A/01/01', warehouseCode: 'NYC-01', quantity: 3200, status: StockStatus.Available, expiryDate: '2026-08-14' },
    { lot: 'L-24075', locationPath: 'C/01/02', warehouseCode: 'IST-01', quantity: 3000, status: StockStatus.Available, expiryDate: '2026-09-02' },
    { lot: 'L-24081', locationPath: 'A/02/01', warehouseCode: 'NYC-01', quantity: 1800, status: StockStatus.Reserved, expiryDate: '2026-08-14' },
    { lot: 'L-24060', locationPath: 'B/01/01', warehouseCode: 'NYC-01', quantity: 300, status: StockStatus.Quarantine, expiryDate: '2026-07-20' },
    { lot: 'L-24060', locationPath: 'B/01/01', warehouseCode: 'NYC-01', quantity: 120, status: StockStatus.Damaged, expiryDate: '2026-07-20' },
  ],
};

const MOCK_LEDGER: Record<string, LedgerEntry[]> = {
  'SKU-1001': [
    { id: 'mv-1', date: '2026-07-28 09:12', type: 'Receipt', quantity: 3200, toLocation: 'A/01/01', runningBalance: 8420, reasonCode: 'ASN-4887' },
    { id: 'mv-2', date: '2026-07-27 14:03', type: 'Pick', quantity: -450, fromLocation: 'A/01/01', runningBalance: 5220, reasonCode: 'PK-2790' },
    { id: 'mv-3', date: '2026-07-27 08:40', type: 'Cycle Count Adj.', quantity: -30, fromLocation: 'B/01/01', runningBalance: 5670, reasonCode: 'CC-118' },
    { id: 'mv-4', date: '2026-07-26 17:22', type: 'Putaway', quantity: 1800, toLocation: 'A/02/01', runningBalance: 5700, reasonCode: 'ASN-4880' },
  ],
};

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly api = inject(MockApiService);

  list(): Observable<InventoryRow[]> {
    return this.api.simulate(MOCK_INVENTORY, { delayMs: 400 });
  }

  getBySku(sku: string): Observable<InventoryRow | undefined> {
    return this.api.simulate(MOCK_INVENTORY.find((i) => i.sku === sku), { delayMs: 300 });
  }

  getLots(sku: string): Observable<InventoryLotRow[]> {
    return this.api.simulate(MOCK_LOTS[sku] ?? [], { delayMs: 300 });
  }

  getLedger(sku: string): Observable<LedgerEntry[]> {
    return this.api.simulate(MOCK_LEDGER[sku] ?? [], { delayMs: 300 });
  }
}
