import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FaultInjectionService } from '../../../core/api/fault-injection.service';
import { db, resetDbToSampleData } from './mock-data';
import { DbPersistenceService } from './db-persistence.service';
import { ReceivingService } from './receiving.service';

describe('ReceivingService - processable ASN creation', () => {
  let service: ReceivingService;
  let persistence: DbPersistenceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    resetDbToSampleData();
    service = TestBed.inject(ReceivingService);
    persistence = TestBed.inject(DbPersistenceService);
    persistence.clear();
    TestBed.inject(FaultInjectionService).reset();
  });

  afterEach(() => {
    persistence.clear();
    resetDbToSampleData();
  });

  it('creates an ASN together with its receivable line', async () => {
    const sku = db.skus[0];
    const asn = await firstValueFrom(
      service.create({
        number: 'ASN-9999',
        supplierName: 'Anadolu Tedarik A.Ş.',
        warehouseCode: db.warehouses[0].code,
        expectedDate: '2026-08-14',
        skuCode: sku.code,
        expectedQuantity: 24,
        lot: sku.lotTracked ? 'LOT-ANK-01' : undefined,
      }),
    );

    const line = db.receiptLines.find((row) => row.asnNumber === asn.number);
    expect(asn.number).toBe('ASN-9999');
    expect(line?.skuCode).toBe(sku.code);
    expect(line?.expectedQuantity).toBe(24);
    expect(line?.status).toBe('pending');
  });
});
