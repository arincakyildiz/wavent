import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ASNStatus, ReceiptLineStatus } from '../models/entities';

export interface AsnRow {
  id: string;
  number: string;
  supplierName: string;
  warehouseCode: string;
  expectedDate: string;
  status: ASNStatus;
  lineCount: number;
}

export interface ReceiptLineRow {
  id: string;
  sku: string;
  lot?: string;
  expectedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  status: ReceiptLineStatus;
}

const MOCK_ASNS: AsnRow[] = [
  { id: 'asn-1', number: 'ASN-4887', supplierName: 'FreshFarm Co.', warehouseCode: 'NYC-01', expectedDate: '2026-07-30', status: 'receiving', lineCount: 4 },
  { id: 'asn-2', number: 'ASN-4886', supplierName: 'Global Bottling Ltd.', warehouseCode: 'AMS-01', expectedDate: '2026-07-29', status: 'closed', lineCount: 2 },
  { id: 'asn-3', number: 'ASN-4885', supplierName: 'ScanTech Devices', warehouseCode: 'NYC-01', expectedDate: '2026-08-01', status: 'expected', lineCount: 3 },
  { id: 'asn-4', number: 'ASN-4884', supplierName: 'Nordic Frozen Foods', warehouseCode: 'IST-01', expectedDate: '2026-07-28', status: 'closed', lineCount: 5 },
  { id: 'asn-5', number: 'ASN-4883', supplierName: 'CleanCare Supplies', warehouseCode: 'DXB-01', expectedDate: '2026-07-27', status: 'cancelled', lineCount: 1 },
];

const MOCK_LINES: Record<string, ReceiptLineRow[]> = {
  'asn-1': [
    { id: 'rl-1', sku: 'SKU-1001', lot: 'L-24081', expectedQuantity: 3200, receivedQuantity: 3200, damagedQuantity: 0, status: 'matched' },
    { id: 'rl-2', sku: 'SKU-1006', lot: 'L-24090', expectedQuantity: 1500, receivedQuantity: 1400, damagedQuantity: 60, status: 'short' },
    { id: 'rl-3', sku: 'SKU-1002', expectedQuantity: 900, receivedQuantity: 950, damagedQuantity: 0, status: 'over' },
    { id: 'rl-4', sku: 'SKU-1004', lot: 'L-24070', expectedQuantity: 600, receivedQuantity: 0, damagedQuantity: 0, status: 'quarantined' },
  ],
};

@Injectable({ providedIn: 'root' })
export class ReceivingService {
  private readonly api = inject(MockApiService);

  list(): Observable<AsnRow[]> {
    return this.api.simulate(MOCK_ASNS, { delayMs: 350 });
  }

  getById(id: string): Observable<AsnRow | undefined> {
    return this.api.simulate(MOCK_ASNS.find((a) => a.id === id), { delayMs: 300 });
  }

  getLines(id: string): Observable<ReceiptLineRow[]> {
    return this.api.simulate(MOCK_LINES[id] ?? [], { delayMs: 300 });
  }
}
