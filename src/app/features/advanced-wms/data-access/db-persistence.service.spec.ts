import { TestBed } from '@angular/core/testing';
import { DbPersistenceService } from './db-persistence.service';
import { clearDb, db, resetDbToSampleData } from './mock-data';

describe('DbPersistenceService', () => {
  let service: DbPersistenceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DbPersistenceService);
    service.clear();
    clearDb();
  });

  afterEach(() => {
    service.clear();
    resetDbToSampleData();
  });

  it('restores a complete graph without replacing collection references', () => {
    const warehousesReference = db.warehouses;
    db.warehouses.push({
      id: 'wh-test',
      code: 'ANK-01',
      name: 'Ankara Dağıtım Merkezi',
      city: 'Ankara',
      country: 'Türkiye',
      lon: 32.85,
      lat: 39.93,
      timezone: 'Europe/Istanbul',
      open: '06:00',
      close: '22:00',
      isActive: true,
      version: 1,
    });
    service.persist();
    clearDb();

    expect(service.hydrate()).toBeTrue();
    expect(db.warehouses).toBe(warehousesReference);
    expect(db.warehouses[0].code).toBe('ANK-01');
  });
});
