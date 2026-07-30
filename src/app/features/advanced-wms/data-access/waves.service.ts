import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { WaveStatus } from '../models/entities';

export interface WaveRow {
  id: string;
  name: string;
  warehouseCode: string;
  zone?: string;
  carrier?: string;
  cutOffTime: string;
  orderCount: number;
  capacityUsedPct: number;
  status: WaveStatus;
}

export interface WaveOrderRow {
  orderNumber: string;
  priority: number;
  route: string;
  lineCount: number;
  status: 'ok' | 'capacity-risk' | 'stock-shortage';
  reason?: string;
}

const MOCK_WAVES: WaveRow[] = [
  { id: 'wv-1', name: 'Wave #251', warehouseCode: 'NYC-01', zone: 'A', carrier: 'DHL Express', cutOffTime: '14:00', orderCount: 42, capacityUsedPct: 88, status: 'released' },
  { id: 'wv-2', name: 'Wave #252', warehouseCode: 'NYC-01', zone: 'B', carrier: 'UPS', cutOffTime: '16:00', orderCount: 30, capacityUsedPct: 62, status: 'planned' },
  { id: 'wv-3', name: 'Wave #253', warehouseCode: 'IST-01', carrier: 'Aramex', cutOffTime: '18:00', orderCount: 18, capacityUsedPct: 40, status: 'draft' },
  { id: 'wv-4', name: 'Wave #250', warehouseCode: 'AMS-01', zone: 'A', carrier: 'Maersk', cutOffTime: '10:00', orderCount: 24, capacityUsedPct: 100, status: 'completed' },
  { id: 'wv-5', name: 'Wave #254', warehouseCode: 'DXB-01', carrier: 'FedEx', cutOffTime: '20:00', orderCount: 12, capacityUsedPct: 95, status: 'released' },
];

const MOCK_WAVE_ORDERS: Record<string, WaveOrderRow[]> = {
  'wv-1': [
    { orderNumber: 'SO-10581', priority: 1, route: 'NYC-Manhattan-01', lineCount: 6, status: 'ok' },
    { orderNumber: 'SO-10582', priority: 2, route: 'NYC-Brooklyn-02', lineCount: 3, status: 'capacity-risk', reason: 'Vardiya kapasitesi %88 dolulukta' },
    { orderNumber: 'SO-10583', priority: 1, route: 'NYC-Queens-01', lineCount: 8, status: 'stock-shortage', reason: 'SKU-1006 için yeterli stok yok' },
    { orderNumber: 'SO-10584', priority: 3, route: 'NYC-Manhattan-02', lineCount: 2, status: 'ok' },
  ],
};

@Injectable({ providedIn: 'root' })
export class WavesService {
  private readonly api = inject(MockApiService);

  list(): Observable<WaveRow[]> {
    return this.api.simulate(MOCK_WAVES, { delayMs: 350 });
  }

  getById(id: string): Observable<WaveRow | undefined> {
    return this.api.simulate(MOCK_WAVES.find((w) => w.id === id), { delayMs: 300 });
  }

  getOrders(id: string): Observable<WaveOrderRow[]> {
    return this.api.simulate(MOCK_WAVE_ORDERS[id] ?? [], { delayMs: 300 });
  }

  release(id: string): Observable<WaveRow | undefined> {
    const wave = MOCK_WAVES.find((w) => w.id === id);
    if (wave) wave.status = 'released';
    return this.api.simulate(wave, { delayMs: 400 });
  }
}
