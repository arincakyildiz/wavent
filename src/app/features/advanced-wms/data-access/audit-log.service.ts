import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';

export interface AuditEventRow {
  id: string;
  date: string;
  actor: string;
  actionType: string;
  targetType: string;
  targetId: string;
  oldValue?: string;
  newValue?: string;
}

const MOCK_AUDIT: AuditEventRow[] = [
  { id: 'ae-1', date: '2026-07-29 18:00', actor: 'Michael Brown', actionType: 'Shipment Closed', targetType: 'Shipment', targetId: 'SHP-7821', oldValue: 'loading', newValue: 'in-transit' },
  { id: 'ae-2', date: '2026-07-29 16:10', actor: 'Sarah Lee', actionType: 'Package Sealed', targetType: 'Package', targetId: 'PK-4501', oldValue: 'open', newValue: 'sealed' },
  { id: 'ae-3', date: '2026-07-29 15:20', actor: 'John Doe', actionType: 'Pick Completed', targetType: 'PickTask', targetId: 'PK-2815', oldValue: 'in-progress', newValue: 'completed' },
  { id: 'ae-4', date: '2026-07-29 11:05', actor: 'System', actionType: 'Allocation Created', targetType: 'Allocation', targetId: 'SO-10581', oldValue: '—', newValue: '1200 @ L-24081' },
  { id: 'ae-5', date: '2026-07-28 14:03', actor: 'Michael Brown', actionType: 'Manual Override', targetType: 'SalesOrder', targetId: 'SO-10588', oldValue: 'L-24075', newValue: 'L-24081' },
  { id: 'ae-6', date: '2026-07-28 09:40', actor: 'System', actionType: 'Putaway Accepted', targetType: 'PutawaySuggestion', targetId: 'PW-1', oldValue: 'pending', newValue: 'accepted' },
  { id: 'ae-7', date: '2026-07-27 08:40', actor: 'Jessica Park', actionType: 'Cycle Count Adjustment', targetType: 'StockMovement', targetId: 'CC-118', oldValue: '5700', newValue: '5670' },
];

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly api = inject(MockApiService);

  list(): Observable<AuditEventRow[]> {
    return this.api.simulate(MOCK_AUDIT, { delayMs: 350 });
  }
}
