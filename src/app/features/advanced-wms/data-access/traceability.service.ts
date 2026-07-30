import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';

export interface TraceEvent {
  id: string;
  date: string;
  stage: 'Receipt' | 'Putaway' | 'Reservation' | 'Pick' | 'Pack' | 'Shipment';
  description: string;
  referenceId: string;
  actor: string;
}

const MOCK_LOTS = ['L-24081', 'L-24075', 'L-24060', 'L-24090', 'L-24070'];

const MOCK_TRACE: Record<string, TraceEvent[]> = {
  'L-24081': [
    { id: 'tr-1', date: '2026-07-28 09:12', stage: 'Receipt', description: 'ASN-4887 üzerinden 3200 adet kabul edildi', referenceId: 'ASN-4887', actor: 'System' },
    { id: 'tr-2', date: '2026-07-28 09:40', stage: 'Putaway', description: 'A/01/01 lokasyonuna yerleştirildi (skor 96)', referenceId: 'PW-1', actor: 'System' },
    { id: 'tr-3', date: '2026-07-29 11:05', stage: 'Reservation', description: 'SO-10581 için 1200 adet FEFO ile rezerve edildi', referenceId: 'SO-10581', actor: 'System' },
    { id: 'tr-4', date: '2026-07-29 15:20', stage: 'Pick', description: 'PK-2815 görevinde toplandı', referenceId: 'PK-2815', actor: 'John Doe' },
    { id: 'tr-5', date: '2026-07-29 16:10', stage: 'Pack', description: 'Paket içerik doğrulaması tamamlandı', referenceId: 'PK-4501', actor: 'Sarah Lee' },
    { id: 'tr-6', date: '2026-07-29 18:00', stage: 'Shipment', description: 'SHP-7821 ile DHL Express üzerinden sevk edildi', referenceId: 'SHP-7821', actor: 'Michael Brown' },
  ],
};

@Injectable({ providedIn: 'root' })
export class TraceabilityService {
  private readonly api = inject(MockApiService);

  listLots(): Observable<string[]> {
    return this.api.simulate(MOCK_LOTS, { delayMs: 250 });
  }

  getTrace(lot: string): Observable<TraceEvent[]> {
    return this.api.simulate(MOCK_TRACE[lot] ?? [], { delayMs: 350 });
  }
}
