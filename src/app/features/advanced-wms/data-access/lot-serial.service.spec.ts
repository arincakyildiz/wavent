import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { isApiError } from '../../../core/api/api-error';
import { FaultInjectionService } from '../../../core/api/fault-injection.service';
import { LotSerialService, SerialDraft } from './lot-serial.service';
import { db } from './mock-data';

/**
 * §10 at the write boundary: the async form validator can only report what was true
 * when the operator typed, so the service is what actually keeps serials unique.
 */
describe('LotSerialService — serial registration (§10)', () => {
  let service: LotSerialService;
  let addedIds: string[] = [];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LotSerialService);
    TestBed.inject(FaultInjectionService).reset();
    addedIds = [];
  });

  afterEach(() => {
    // Drop anything the specs wrote so the shared dataset stays as seeded.
    for (const id of addedIds) {
      const index = db.balances.findIndex((b) => b.id === id);
      if (index !== -1) db.balances.splice(index, 1);
    }
  });

  function draft(overrides: Partial<SerialDraft> = {}): SerialDraft {
    const sku = db.skus.find((s) => s.serialTracked)!;
    const bin = db.locations.find((l) => l.type === 'bin')!;

    return {
      skuCode: sku.code,
      serial: `SN-SPEC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      warehouseCode: bin.warehouseCode,
      locationPath: bin.path,
      ...overrides,
    };
  }

  it('registers a serialised unit with exactly one unit of stock', async () => {
    const input = draft();
    const row = await firstValueFrom(service.registerSerial(input));
    addedIds.push(row.id);

    expect(row.serial).toBe(input.serial);
    expect(row.quantity).toBe(1);

    const stored = db.balances.find((b) => b.id === row.id)!;
    expect(stored.quantity).toBe(1);
    expect(stored.skuCode).toBe(input.skuCode);
  });

  it('rejects a serial already registered for that SKU', async () => {
    const input = draft();
    const first = await firstValueFrom(service.registerSerial(input));
    addedIds.push(first.id);

    let error: unknown;
    try {
      // Same SKU + same serial, i.e. the exact case the rule forbids.
      await firstValueFrom(service.registerSerial(input));
    } catch (e) {
      error = e;
    }

    expect(isApiError(error) && error.kind).toBe('conflict');
  });

  it('allows the same serial on a different SKU', async () => {
    const serialTracked = db.skus.filter((s) => s.serialTracked);
    if (serialTracked.length < 2) return pending('dataset has only one serial-tracked SKU');

    const serial = `SN-SPEC-SHARED-${Date.now()}`;
    const first = await firstValueFrom(
      service.registerSerial(draft({ skuCode: serialTracked[0].code, serial })),
    );
    addedIds.push(first.id);

    const second = await firstValueFrom(
      service.registerSerial(draft({ skuCode: serialTracked[1].code, serial })),
    );
    addedIds.push(second.id);

    expect(second.serial).toBe(serial);
  });

  it('refuses a SKU that is not serial-tracked', async () => {
    const bulk = db.skus.find((s) => !s.serialTracked);
    if (!bulk) return pending('dataset has no non-serial SKU');

    let error: unknown;
    try {
      await firstValueFrom(service.registerSerial(draft({ skuCode: bulk.code })));
    } catch (e) {
      error = e;
    }

    expect(isApiError(error) && error.kind).toBe('validation');
  });

  it('refuses an unknown location', async () => {
    let error: unknown;
    try {
      await firstValueFrom(service.registerSerial(draft({ locationPath: 'Z/99/99' })));
    } catch (e) {
      error = e;
    }

    expect(isApiError(error) && error.kind).toBe('validation');
  });

  it('reports a registered serial as unavailable to the form validator', async () => {
    const input = draft();
    const row = await firstValueFrom(service.registerSerial(input));
    addedIds.push(row.id);

    const available = await firstValueFrom(
      service.isSerialAvailable(input.skuCode, input.serial),
    );
    expect(available).toBe(false);
  });
});
