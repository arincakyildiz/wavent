import { Injectable, computed, inject, signal } from '@angular/core';
import { LocalStorageService } from '../../../core/storage/local-storage.service';
import { WarehouseScopeService } from '../../../core/state/warehouse-scope.service';
import { clearDb, db, resetDbToSampleData } from './mock-data';
import { DbPersistenceService } from './db-persistence.service';

const SAMPLE_DATA_KEY = 'sample-data-loaded';

@Injectable({ providedIn: 'root' })
export class DemoDataService {
  private readonly storage = inject(LocalStorageService);
  private readonly warehouseScope = inject(WarehouseScopeService);
  private readonly persistence = inject(DbPersistenceService);
  private readonly hasSampleData = signal(false);
  private readonly dataRevision = signal(0);
  private initialized = false;

  readonly loaded = computed(() => this.hasSampleData() || this.persistence.hasSnapshot());
  readonly revision = this.dataRevision.asReadonly();
  readonly recordCount = computed(() => {
    this.hasSampleData();
    return Object.values(db).reduce((total, rows) => total + rows.length, 0);
  });

  /** Runs before routing so first-time users never see the prebuilt fixture flash on screen. */
  initialize(): void {
    if (this.initialized) return;
    const shouldLoad = this.storage.read(SAMPLE_DATA_KEY, false);
    const restored = this.persistence.hydrate();
    if (!restored && shouldLoad) {
      resetDbToSampleData();
      this.persistence.persist();
    } else if (!restored) {
      clearDb();
    }
    this.warehouseScope.syncAvailable(db.warehouses.map(({ code, name }) => ({ code, name })));
    this.hasSampleData.set(restored || shouldLoad);
    this.initialized = true;
  }

  loadSampleData(): void {
    resetDbToSampleData();
    this.warehouseScope.resetRegistered();
    this.persistence.persist();
    this.storage.write(SAMPLE_DATA_KEY, true);
    this.hasSampleData.set(true);
    this.dataRevision.update((value) => value + 1);
  }

  clearAllData(): void {
    clearDb();
    this.warehouseScope.resetRegistered();
    this.persistence.clear();
    this.storage.remove(SAMPLE_DATA_KEY);
    this.hasSampleData.set(false);
    this.dataRevision.update((value) => value + 1);
  }
}
