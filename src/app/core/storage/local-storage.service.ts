import { Injectable } from '@angular/core';

/**
 * Typed, fail-safe wrapper over `localStorage`.
 *
 * Storage throws in private mode and when a quota is hit, and every call site
 * otherwise has to repeat the same try/catch. Persisting a preference must never
 * break the feature that owns it, so every method degrades to a session-only value
 * instead of propagating the error.
 */
@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  /** Namespaced so a demo on a shared origin cannot collide with another app. */
  private readonly prefix = 'wavent.';

  /** Reads a JSON value, falling back when absent, unreadable or malformed. */
  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  /** Reads a plain string; use over {@link read} for values written by other tools. */
  readRaw(key: string): string | null {
    try {
      return localStorage.getItem(this.prefix + key);
    } catch {
      return null;
    }
  }

  write<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      // Storage unavailable or full — the value stays in memory for this session.
    }
  }

  writeRaw(key: string, value: string): void {
    try {
      localStorage.setItem(this.prefix + key, value);
    } catch {
      // see write()
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      // nothing to do — the key is already unreachable
    }
  }

  /** True when persistence actually works, so callers can warn if it matters. */
  get available(): boolean {
    try {
      const probe = `${this.prefix}__probe`;
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }
}
