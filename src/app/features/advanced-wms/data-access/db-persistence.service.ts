import { Injectable, inject, signal } from '@angular/core';
import { MonoTypeOperatorFunction, tap } from 'rxjs';
import { LocalStorageService } from '../../../core/storage/local-storage.service';
import { Db, db, restoreDb } from './mock-data';

const DB_STORAGE_KEY = 'wms-db-v1';
const DB_SCHEMA_VERSION = 1;
const COLLECTIONS: (keyof Db)[] = [
  'warehouses',
  'locations',
  'skus',
  'balances',
  'orders',
  'allocations',
  'waves',
  'pickTasks',
  'packages',
  'shipments',
  'asns',
  'receiptLines',
  'putaway',
  'cycleCounts',
  'exceptions',
  'movements',
  'auditEvents',
  'operators',
  'carriers',
];

interface StoredDb {
  schemaVersion: number;
  data: Db;
}

function isStoredDb(value: unknown): value is StoredDb {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredDb>;
  if (candidate.schemaVersion !== DB_SCHEMA_VERSION || !candidate.data) return false;
  return COLLECTIONS.every((key) => Array.isArray(candidate.data?.[key]));
}

@Injectable({ providedIn: 'root' })
export class DbPersistenceService {
  private readonly storage = inject(LocalStorageService);
  private readonly snapshotAvailable = signal(false);

  readonly hasSnapshot = this.snapshotAvailable.asReadonly();

  hydrate(): boolean {
    const stored = this.storage.read<unknown>(DB_STORAGE_KEY, null);
    if (!isStoredDb(stored)) return false;
    restoreDb(stored.data);
    this.snapshotAvailable.set(true);
    return true;
  }

  persist(): void {
    this.storage.write<StoredDb>(DB_STORAGE_KEY, {
      schemaVersion: DB_SCHEMA_VERSION,
      data: db,
    });
    this.snapshotAvailable.set(true);
  }

  afterWrite<T>(): MonoTypeOperatorFunction<T> {
    return tap(() => this.persist());
  }

  clear(): void {
    this.storage.remove(DB_STORAGE_KEY);
    this.snapshotAvailable.set(false);
  }
}
