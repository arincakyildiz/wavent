import { Injectable } from '@angular/core';
import { delay, Observable, of, throwError } from 'rxjs';

export interface MockApiOptions {
  delayMs?: number;
  failRate?: number;
}

@Injectable({ providedIn: 'root' })
export class MockApiService {
  simulate<T>(data: T, options: MockApiOptions = {}): Observable<T> {
    const { delayMs = 350, failRate = 0 } = options;

    if (failRate > 0 && Math.random() < failRate) {
      return throwError(() => new Error('Simulated network error')).pipe(delay(delayMs));
    }

    return of(data).pipe(delay(delayMs));
  }
}
