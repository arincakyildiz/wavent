import { Injectable, signal } from '@angular/core';
import { ApiErrorKind } from './api-error';

export interface FaultProfile {
  /** Probability (0..1) that a read fails with a transient network error. */
  readFailRate: number;
  /** Probability (0..1) that a write fails with a transient network error. */
  writeFailRate: number;
  /** Extra latency added to every call, to exercise loading states. */
  extraLatencyMs: number;
  /** Force the next call to fail with this kind, then reset. */
  nextFailure: ApiErrorKind | null;
}

const OFF: FaultProfile = {
  readFailRate: 0,
  writeFailRate: 0,
  extraLatencyMs: 0,
  nextFailure: null,
};

/**
 * Central switchboard for simulated backend faults. Kept out of MockApiService so
 * the Settings screen (and tests) can drive failure scenarios deterministically
 * instead of every service hard-coding a probability.
 */
@Injectable({ providedIn: 'root' })
export class FaultInjectionService {
  private readonly state = signal<FaultProfile>({ ...OFF });

  readonly profile = this.state.asReadonly();

  patch(partial: Partial<FaultProfile>): void {
    this.state.update((p) => ({ ...p, ...partial }));
  }

  reset(): void {
    this.state.set({ ...OFF });
  }

  /** Arms a one-shot deterministic failure — used by "simulate error" buttons and tests. */
  armNextFailure(kind: ApiErrorKind): void {
    this.state.update((p) => ({ ...p, nextFailure: kind }));
  }

  /** Consumes the armed failure, if any. */
  takeArmedFailure(): ApiErrorKind | null {
    const armed = this.state().nextFailure;
    if (armed) this.state.update((p) => ({ ...p, nextFailure: null }));
    return armed;
  }
}
