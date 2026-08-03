import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { isApiError } from '../../../core/api/api-error';
import { FaultInjectionService } from '../../../core/api/fault-injection.service';
import { PackageRec, db } from './mock-data';
import { PackingService } from './packing.service';

/**
 * §2 + §10: the bench scale records what it measured, but it must never be able to
 * wave its own deviation through — that is the supervisor's call.
 */
describe('PackingService — scale readings (§2/§10)', () => {
  let service: PackingService;
  let restore: (() => void) | null = null;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PackingService);
    TestBed.inject(FaultInjectionService).reset();
  });

  afterEach(() => {
    restore?.();
    restore = null;
  });

  /** A package that can still be weighed, remembering how to put it back. */
  function takeWeighable(): PackageRec | null {
    const record = db.packages.find((p) => p.status !== 'shipped');
    if (!record) return null;

    const snapshot = { ...record };
    restore = () => Object.assign(record, snapshot);
    return record;
  }

  it('records a reading inside tolerance and seals the package', async () => {
    const record = takeWeighable();
    if (!record) return pending('no weighable package');

    // Dead on the expectation, so the tolerance rule is satisfied.
    const row = await firstValueFrom(
      service.recordWeight(record.id, record.version, record.expectedWeightKg),
    );

    expect(row.weightKg).toBe(record.expectedWeightKg);
    expect(row.weightOk).toBe(true);
    expect(row.status).toBe('sealed');
    expect(row.version).toBe(record.version);
  });

  it('puts a reading outside tolerance back on weight-hold', async () => {
    const record = takeWeighable();
    if (!record) return pending('no weighable package');

    const overweight = record.expectedWeightKg + record.toleranceKg + 5;
    const row = await firstValueFrom(service.recordWeight(record.id, record.version, overweight));

    expect(row.weightOk).toBe(false);
    expect(row.status).toBe('weight-hold');
  });

  it('never moves the expectation to match the scale', async () => {
    const record = takeWeighable();
    if (!record) return pending('no weighable package');

    const expectedBefore = record.expectedWeightKg;
    await firstValueFrom(
      service.recordWeight(record.id, record.version, expectedBefore + record.toleranceKg + 9),
    );

    // If the reading redefined the expectation, every package would always "pass".
    expect(record.expectedWeightKg).toBe(expectedBefore);
  });

  it('rejects a stale version rather than overwriting a newer weight', async () => {
    const record = takeWeighable();
    if (!record) return pending('no weighable package');

    const stale = record.version;
    await firstValueFrom(service.recordWeight(record.id, stale, record.expectedWeightKg));

    let error: unknown;
    try {
      await firstValueFrom(service.recordWeight(record.id, stale, record.expectedWeightKg));
    } catch (e) {
      error = e;
    }

    expect(isApiError(error) && error.kind).toBe('conflict');
  });

  it('refuses a nonsensical reading', async () => {
    const record = takeWeighable();
    if (!record) return pending('no weighable package');

    let error: unknown;
    try {
      await firstValueFrom(service.recordWeight(record.id, record.version, 0));
    } catch (e) {
      error = e;
    }

    expect(isApiError(error) && error.kind).toBe('validation');
  });

  it('refuses to re-weigh a shipped package', async () => {
    const shipped = db.packages.find((p) => p.status === 'shipped');
    if (!shipped) return pending('no shipped package in dataset');

    let error: unknown;
    try {
      await firstValueFrom(service.recordWeight(shipped.id, shipped.version, 10));
    } catch (e) {
      error = e;
    }

    expect(isApiError(error) && error.kind).toBe('validation');
  });
});
