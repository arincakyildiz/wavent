import { Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Small in-memory TTL cache for read-heavy lookups whose answer is stable for a
 * few seconds (reference data, availability probes fired per keystroke).
 *
 * Deliberately not persisted: cached stock figures that outlive a session would be
 * worse than no cache at all, since a stale quantity reads as a real one.
 */
@Injectable({ providedIn: 'root' })
export class CacheService {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  /** Default lifetime — long enough to collapse a burst, short enough to stay honest. */
  static readonly DEFAULT_TTL_MS = 5_000;

  /**
   * Returns the cached value when it is still fresh, otherwise subscribes to
   * `source` and caches what it emits.
   */
  through<T>(key: string, source: Observable<T>, ttlMs = CacheService.DEFAULT_TTL_MS): Observable<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return of(hit);

    return source.pipe(tap((value) => this.set(key, value, ttlMs)));
  }

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = CacheService.DEFAULT_TTL_MS): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Drops one key, or every key starting with `prefix` after a write invalidates it. */
  invalidate(prefix: string): void {
    for (const key of [...this.entries.keys()]) {
      if (key === prefix || key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
