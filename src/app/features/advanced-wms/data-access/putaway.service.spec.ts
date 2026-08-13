import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { isApiError } from '../../../core/api/api-error';
import { FaultInjectionService } from '../../../core/api/fault-injection.service';
import { PutawayRec, db, resetDbToSampleData } from './mock-data';
import { PutawayService, PutawaySuggestionRow } from './putaway.service';

describe('PutawayService - capacity override', () => {
  let service: PutawayService;
  let record: PutawayRec;
  let row: PutawaySuggestionRow;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    resetDbToSampleData();
    service = TestBed.inject(PutawayService);
    TestBed.inject(FaultInjectionService).reset();

    const result = await firstValueFrom(
      service.query([], { page: 1, pageSize: 1000 }),
    );
    const violating = result.rows.find((candidate) => !candidate.capacityOk && !candidate.accepted);
    if (!violating) return;

    row = violating;
    record = db.putaway.find((candidate) => candidate.id === row.id)!;
  });

  afterEach(() => resetDbToSampleData());

  it('rejects a capacity violation without a meaningful reason', async () => {
    if (!row) return pending('no capacity-violating suggestion in the seeded dataset');

    let error: unknown;
    try {
      await firstValueFrom(service.accept(row.id, row.version, 'kısa'));
    } catch (caught) {
      error = caught;
    }

    expect(isApiError(error) && error.kind).toBe('validation');
    expect(record.accepted).toBe(false);
  });

  it('accepts a justified capacity override and bumps the version', async () => {
    if (!row) return pending('no capacity-violating suggestion in the seeded dataset');

    const updated = await firstValueFrom(
      service.accept(row.id, row.version, 'Vardiya lideri kapasite aşımını onayladı'),
    );

    expect(updated.accepted).toBe(true);
    expect(updated.version).toBe(row.version + 1);
  });

  it('moves accepted stock into the target balance and records capacity and movement once', async () => {
    const result = await firstValueFrom(service.query([], { page: 1, pageSize: 1000 }));
    const suggestion = result.rows.find((candidate) => candidate.capacityOk && !candidate.accepted);
    if (!suggestion) return pending('no acceptable suggestion in seeded dataset');
    const location = db.locations.find((candidate) => candidate.path === suggestion.suggestedLocationPath && candidate.warehouseCode === suggestion.warehouseCode)!;
    const balanceBefore = db.balances
      .filter((balance) => balance.skuCode === suggestion.skuCode && balance.lot === suggestion.lot && balance.locationPath === suggestion.suggestedLocationPath)
      .reduce((sum, balance) => sum + balance.quantity, 0);
    const weightBefore = location.usedWeightKg;
    const movementCount = db.movements.length;

    const accepted = await firstValueFrom(service.accept(suggestion.id, suggestion.version));
    const balanceAfter = db.balances
      .filter((balance) => balance.skuCode === suggestion.skuCode && balance.lot === suggestion.lot && balance.locationPath === suggestion.suggestedLocationPath)
      .reduce((sum, balance) => sum + balance.quantity, 0);
    expect(balanceAfter).toBe(balanceBefore + suggestion.quantity);
    expect(location.usedWeightKg).toBeGreaterThan(weightBefore);
    expect(db.movements.length).toBe(movementCount + 1);

    let error: unknown;
    try { await firstValueFrom(service.accept(accepted.id, accepted.version)); } catch (caught) { error = caught; }
    expect(isApiError(error) && error.kind).toBe('validation');
    expect(db.movements.length).toBe(movementCount + 1);
  });
});
