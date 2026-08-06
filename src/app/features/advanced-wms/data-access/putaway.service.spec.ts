import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { isApiError } from '../../../core/api/api-error';
import { FaultInjectionService } from '../../../core/api/fault-injection.service';
import { PutawayRec, db } from './mock-data';
import { PutawayService, PutawaySuggestionRow } from './putaway.service';

describe('PutawayService - capacity override', () => {
  let service: PutawayService;
  let record: PutawayRec;
  let row: PutawaySuggestionRow;
  let snapshot: Pick<PutawayRec, 'accepted' | 'version'>;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PutawayService);
    TestBed.inject(FaultInjectionService).reset();

    const result = await firstValueFrom(
      service.query([], { page: 1, pageSize: 1000 }),
    );
    const violating = result.rows.find((candidate) => !candidate.capacityOk && !candidate.accepted);
    if (!violating) return;

    row = violating;
    record = db.putaway.find((candidate) => candidate.id === row.id)!;
    snapshot = { accepted: record.accepted, version: record.version };
  });

  afterEach(() => {
    if (record && snapshot) Object.assign(record, snapshot);
  });

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
});
