import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ExceptionSeverity, ExceptionStatus, ExceptionType } from '../models/entities';

export interface ExceptionRow {
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  referenceType: string;
  referenceId: string;
  owner?: string;
  status: ExceptionStatus;
  createdAgo: string;
  resolutionNote?: string;
}

const MOCK_EXCEPTIONS: ExceptionRow[] = [
  { id: 'ex-1', type: 'wrong-barcode', severity: 'high', referenceType: 'PickTask', referenceId: 'PK-2815', owner: 'John Doe', status: 'open', createdAgo: '2m ago' },
  { id: 'ex-2', type: 'damage', severity: 'medium', referenceType: 'ReceiptLine', referenceId: 'RCV-1420', owner: 'Sarah Lee', status: 'investigating', createdAgo: '15m ago' },
  { id: 'ex-3', type: 'capacity-overflow', severity: 'critical', referenceType: 'Location', referenceId: 'A-12-03', status: 'open', createdAgo: '32m ago' },
  { id: 'ex-4', type: 'manual-override', severity: 'low', referenceType: 'SalesOrder', referenceId: 'SO-10588', owner: 'Michael Brown', status: 'resolved', createdAgo: '1h ago', resolutionNote: 'Müşteri onayıyla farklı lot kullanıldı' },
  { id: 'ex-5', type: 'short-pick', severity: 'medium', referenceType: 'PickTask', referenceId: 'PK-2790', owner: 'Jessica Park', status: 'investigating', createdAgo: '2h ago' },
  { id: 'ex-6', type: 'shipment-mismatch', severity: 'high', referenceType: 'Shipment', referenceId: 'SHP-7816', status: 'open', createdAgo: '3h ago' },
];

@Injectable({ providedIn: 'root' })
export class ExceptionsService {
  private readonly api = inject(MockApiService);

  list(): Observable<ExceptionRow[]> {
    return this.api.simulate(MOCK_EXCEPTIONS, { delayMs: 350 });
  }

  resolve(id: string, note: string): Observable<ExceptionRow | undefined> {
    const item = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (item) {
      item.status = 'resolved';
      item.resolutionNote = note;
    }
    return this.api.simulate(item, { delayMs: 350 });
  }
}
