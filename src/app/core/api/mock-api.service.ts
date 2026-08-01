import { Injectable, inject } from '@angular/core';
import { Observable, defer, delay, of, throwError } from 'rxjs';
import { ApiError, ApiErrorKind } from './api-error';
import { FaultInjectionService } from './fault-injection.service';

export interface MockApiOptions {
  delayMs?: number;
  /** 'write' calls honour the write fail rate and are never silently retried. */
  kind?: 'read' | 'write';
  /** Deterministic failure for this call, regardless of configured rates. */
  failWith?: ApiErrorKind;
}

@Injectable({ providedIn: 'root' })
export class MockApiService {
  private readonly faults = inject(FaultInjectionService);

  /**
   * Wraps a value in an observable that behaves like a network call: latency,
   * configurable failure, and errors typed as ApiError so callers can branch on
   * unauthorized / conflict / transient cases.
   *
   * `defer` matters here — the failure decision must be made at subscribe time so
   * a retry re-rolls the dice instead of replaying the first outcome.
   */
  simulate<T>(data: T, options: MockApiOptions = {}): Observable<T> {
    const { delayMs = 350, kind = 'read', failWith } = options;

    return defer(() => {
      const profile = this.faults.profile();
      const totalDelay = delayMs + profile.extraLatencyMs;

      const forced = failWith ?? this.faults.takeArmedFailure();
      if (forced) {
        return throwError(() => new ApiError(forced)).pipe(delay(totalDelay));
      }

      const rate = kind === 'write' ? profile.writeFailRate : profile.readFailRate;
      if (rate > 0 && Math.random() < rate) {
        return throwError(() => new ApiError('network')).pipe(delay(totalDelay));
      }

      return of(data).pipe(delay(totalDelay));
    });
  }

  /** Always fails — for wiring explicit "what happens on error" affordances. */
  fail<T>(kind: ApiErrorKind, delayMs = 300): Observable<T> {
    return defer(() => throwError(() => new ApiError(kind)).pipe(delay(delayMs)));
  }

  /**
   * Optimistic-concurrency check. Callers pass the version they read; if the stored
   * record moved on, this raises a conflict carrying the winning version.
   */
  assertVersion(expected: number, current: number): void {
    if (expected !== current) {
      throw new ApiError('conflict', undefined, current);
    }
  }
}
