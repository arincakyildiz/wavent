import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { isApiError } from '../../../core/api/api-error';
import { FaultInjectionService } from '../../../core/api/fault-injection.service';
import { AllocationRec, db } from './mock-data';
import { LotCandidate, ReservationsService } from './reservations.service';

/**
 * §11: two operators re-allocating the same stock must not both win. The service
 * guards on the row `version` (stale screen) and on the target lot's free quantity
 * (someone consumed it in between).
 */
describe('ReservationsService — concurrent override (§11)', () => {
  let service: ReservationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReservationsService);
    TestBed.inject(FaultInjectionService).reset();
  });

  /** An allocation that actually holds stock and has somewhere else to go. */
  async function takeMovableAllocation(): Promise<{
    alloc: AllocationRec;
    candidate: LotCandidate;
    restore: () => void;
  } | null> {
    for (const alloc of db.allocations.filter((a) => a.quantity > 0 && !a.isBackorder)) {
      const candidates = await firstValueFrom(service.candidates(alloc.id));
      const usable = candidates.find((c) => c.freeQuantity >= alloc.quantity);
      if (!usable) continue;

      const snapshot = { ...alloc };
      return {
        alloc,
        candidate: usable,
        restore: () => Object.assign(alloc, snapshot),
      };
    }
    return null;
  }

  it('moves a reservation to another lot and bumps the version', async () => {
    const found = await takeMovableAllocation();
    if (!found) return pending('No movable allocation in the seeded dataset');

    const { alloc, candidate, restore } = found;
    const startVersion = alloc.version;

    const row = await firstValueFrom(
      service.override(alloc.id, startVersion, candidate, 'Müşteri lot değişikliği talep etti'),
    );

    expect(row.lot).toBe(candidate.lot);
    expect(row.locationPath).toBe(candidate.locationPath);
    expect(row.overrideReason).toBe('Müşteri lot değişikliği talep etti');
    expect(row.version).toBe(startVersion + 1);

    restore();
  });

  it('rejects a second write that carries the stale version', async () => {
    const found = await takeMovableAllocation();
    if (!found) return pending('No movable allocation in the seeded dataset');

    const { alloc, candidate, restore } = found;
    const staleVersion = alloc.version;

    // First operator wins.
    await firstValueFrom(service.override(alloc.id, staleVersion, candidate, 'İlk operatör'));

    // Second operator submits from a screen loaded before that write.
    let error: unknown;
    try {
      await firstValueFrom(service.override(alloc.id, staleVersion, candidate, 'İkinci operatör'));
    } catch (e) {
      error = e;
    }

    expect(isApiError(error) && error.kind).toBe('conflict');
    restore();
  });

  it('rejects a move when the target lot no longer has enough free stock', async () => {
    const found = await takeMovableAllocation();
    if (!found) return pending('No movable allocation in the seeded dataset');

    const { alloc, candidate, restore } = found;

    // Simulate a competing reservation eating the target lot between read and write.
    const blocker: AllocationRec = {
      ...alloc,
      id: 'al-test-blocker',
      lot: candidate.lot,
      locationPath: candidate.locationPath,
      quantity: candidate.freeQuantity,
      version: 1,
    };
    db.allocations.push(blocker);

    let error: unknown;
    try {
      await firstValueFrom(service.override(alloc.id, alloc.version, candidate, 'Gerekçe'));
    } catch (e) {
      error = e;
    }

    expect(isApiError(error) && error.kind).toBe('conflict');

    db.allocations.splice(db.allocations.indexOf(blocker), 1);
    restore();
  });
});
