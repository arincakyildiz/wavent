import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { TraceEvent, traceLot, traceableLots } from './selectors';

export type { TraceEvent };

@Injectable({ providedIn: 'root' })
export class TraceabilityService {
  private readonly api = inject(MockApiService);

  listLots(): Observable<string[]> {
    return this.api.simulate(traceableLots(), { delayMs: 250 });
  }

  getTrace(lot: string): Observable<TraceEvent[]> {
    return this.api.simulate(traceLot(lot), { delayMs: 320 });
  }
}
