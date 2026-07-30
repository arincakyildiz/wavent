import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { CycleCountStatus } from '../models/entities';

export interface CycleCountRow {
  id: string;
  code: string;
  warehouseCode: string;
  scopeLabel: string;
  expectedQuantity: number;
  countedQuantity: number;
  status: CycleCountStatus;
  requiresSecondCount: boolean;
}

const VARIANCE_THRESHOLD_PCT = 2;

const RAW: Omit<CycleCountRow, 'id' | 'requiresSecondCount'>[] = [
  { code: 'CC-118', warehouseCode: 'NYC-01', scopeLabel: 'A/01/01 - A/01/05', expectedQuantity: 5700, countedQuantity: 5670, status: 'closed' },
  { code: 'CC-119', warehouseCode: 'NYC-01', scopeLabel: 'SKU-1006', expectedQuantity: 12400, countedQuantity: 11800, status: 'variance-review' },
  { code: 'CC-120', warehouseCode: 'IST-01', scopeLabel: 'C/01/01 - C/01/02', expectedQuantity: 430, countedQuantity: 425, status: 'closed' },
  { code: 'CC-121', warehouseCode: 'AMS-01', scopeLabel: 'A/03/01 - A/03/02', expectedQuantity: 820, countedQuantity: 640, status: 'in-progress' },
  { code: 'CC-122', warehouseCode: 'DXB-01', scopeLabel: 'HZ/01/01', expectedQuantity: 90, countedQuantity: 90, status: 'scheduled' },
];

function variancePct(expected: number, counted: number): number {
  if (!expected) return 0;
  return Math.abs((expected - counted) / expected) * 100;
}

const MOCK_CYCLE_COUNTS: CycleCountRow[] = RAW.map((r, i) => ({
  id: `cc-${i + 1}`,
  ...r,
  requiresSecondCount: variancePct(r.expectedQuantity, r.countedQuantity) > VARIANCE_THRESHOLD_PCT,
}));

@Injectable({ providedIn: 'root' })
export class CycleCountsService {
  private readonly api = inject(MockApiService);

  list(): Observable<CycleCountRow[]> {
    return this.api.simulate(MOCK_CYCLE_COUNTS, { delayMs: 350 });
  }
}

export function cycleVariance(row: CycleCountRow): number {
  return row.countedQuantity - row.expectedQuantity;
}
