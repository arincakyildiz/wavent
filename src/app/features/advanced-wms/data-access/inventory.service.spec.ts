import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { isApiError } from '../../../core/api/api-error';
import { FaultInjectionService } from '../../../core/api/fault-injection.service';
import { StockStatus } from '../models/entities';
import { db } from './mock-data';
import { InventoryService } from './inventory.service';

describe('InventoryService - controlled stock adjustments', () => {
  let service: InventoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InventoryService);
    TestBed.inject(FaultInjectionService).reset();
  });

  it('records a versioned, justified adjustment and its movement', async () => {
    const balance = db.balances.find((row) => row.quantity > 0);
    if (!balance) return pending('no adjustable balance');
    const snapshot = { ...balance };
    const movementCount = db.movements.length;

    try {
      const adjusted = await firstValueFrom(
        service.adjustBalance(
          balance.id,
          balance.version,
          balance.quantity + 2,
          StockStatus.Quarantine,
          'Cycle count correction',
        ),
      );

      expect(adjusted.quantity).toBe(snapshot.quantity + 2);
      expect(adjusted.status).toBe(StockStatus.Quarantine);
      expect(adjusted.version).toBe(snapshot.version + 1);
      expect(db.movements.length).toBe(movementCount + 1);
      expect(db.movements[0].quantity).toBe(2);
      expect(db.movements[0].reasonCode).toBe('Cycle count correction');
    } finally {
      Object.assign(balance, snapshot);
      db.movements.splice(0, db.movements.length - movementCount);
    }
  });

  it('rejects an adjustment without a meaningful reason', async () => {
    const balance = db.balances[0];
    let error: unknown;

    try {
      await firstValueFrom(
        service.adjustBalance(balance.id, balance.version, balance.quantity, balance.status, 'no'),
      );
    } catch (caught) {
      error = caught;
    }

    expect(isApiError(error) && error.kind).toBe('validation');
  });

  it('requires serial-tracked opening stock to be registered unit by unit', async () => {
    const warehouse = db.warehouses[0];
    const location = db.locations.find((row) => row.warehouseCode === warehouse.code)!;
    let error: unknown;
    try {
      await firstValueFrom(service.createItem({
        code: 'SKU-SERIAL9', name: 'Seri Takipli Test Ürünü', uom: 'ADET', weightKg: 1,
        volumeM3: 0.01, lotTracked: false, serialTracked: true, storageClass: location.locationClass,
        warehouseCode: warehouse.code, locationPath: location.path, quantity: 2,
      }));
    } catch (caught) {
      error = caught;
    }
    expect(isApiError(error) && error.kind).toBe('validation');
    expect(db.skus.some((row) => row.code === 'SKU-SERIAL9')).toBe(false);
  });
});
