import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface StoredRecord<T> {
  key: string;
  value: T;
  savedAt: number;
}

/** A cached value plus how old it is, so the UI can label stale data honestly. */
export interface CachedSnapshot<T> {
  value: T;
  savedAt: Date;
  ageMs: number;
}

const DB_NAME = 'wavent';
const DB_VERSION = 1;
const STORE = 'snapshots';

/**
 * Promise/observable wrapper over IndexedDB for offline snapshots.
 *
 * Used for data that is worth showing when the network fails — the dashboard
 * summary, reference lists — never for anything a decision is made against without
 * the user knowing it is stale, which is why {@link read} returns the age alongside
 * the value rather than the value alone.
 *
 * Every operation degrades to "no cache" rather than throwing: a browser with
 * IndexedDB disabled must still run the app.
 */
@Injectable({ providedIn: 'root' })
export class IndexedDbService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  /** False when the browser has no usable IndexedDB (private mode, old engines). */
  get supported(): boolean {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  }

  write<T>(key: string, value: T): Observable<boolean> {
    return from(this.put(key, value)).pipe(catchError(() => of(false)));
  }

  /** Reads a snapshot, or null when absent, expired or unreadable. */
  read<T>(key: string, maxAgeMs?: number): Observable<CachedSnapshot<T> | null> {
    return from(this.get<T>(key)).pipe(
      map((record) => {
        if (!record) return null;

        const ageMs = Date.now() - record.savedAt;
        if (maxAgeMs !== undefined && ageMs > maxAgeMs) return null;

        return { value: record.value, savedAt: new Date(record.savedAt), ageMs };
      }),
      catchError(() => of(null)),
    );
  }

  remove(key: string): Observable<boolean> {
    return from(this.delete(key)).pipe(catchError(() => of(false)));
  }

  clear(): Observable<boolean> {
    return from(this.clearAll()).pipe(catchError(() => of(false)));
  }

  /* ---------- IndexedDB plumbing ---------- */

  private open(): Promise<IDBDatabase | null> {
    if (!this.supported) return Promise.resolve(null);

    // One connection per app instance; a failed open is remembered as "no cache"
    // so we do not retry a broken handshake on every read.
    this.dbPromise ??= new Promise<IDBDatabase | null>((resolve) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch {
        resolve(null);
        return;
      }

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });

    return this.dbPromise;
  }

  private async put<T>(key: string, value: T): Promise<boolean> {
    const db = await this.open();
    if (!db) return false;

    return new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      const record: StoredRecord<T> = { key, value, savedAt: Date.now() };
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  }

  private async get<T>(key: string): Promise<StoredRecord<T> | null> {
    const db = await this.open();
    if (!db) return null;

    return new Promise<StoredRecord<T> | null>((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as StoredRecord<T>) ?? null);
      request.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    });
  }

  private async delete(key: string): Promise<boolean> {
    const db = await this.open();
    if (!db) return false;

    return new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  }

  private async clearAll(): Promise<boolean> {
    const db = await this.open();
    if (!db) return false;

    return new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  }
}
