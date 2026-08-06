import { TestBed } from '@angular/core/testing';
import { ApiError, isApiError } from '../../../core/api/api-error';
import { FaultInjectionService } from '../../../core/api/fault-injection.service';
import { db } from './mock-data';
import { waveOrderStatuses } from './selectors';
import { WavesService } from './waves.service';

describe('WavesService', () => {
  let service: WavesService;
  let faults: FaultInjectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WavesService);
    faults = TestBed.inject(FaultInjectionService);
    faults.reset();
  });

  /**
   * Picks a wave that is still publishable AND has at least one order that will
   * actually publish — a wave whose orders are *all* short on stock makes release()
   * legitimately reject the whole call, which isn't what these tests exercise.
   */
  function takePlannedWave() {
    const wave = db.waves.find(
      (w) =>
        (w.status === 'planned' || w.status === 'draft') &&
        waveOrderStatuses(w.id).some((s) => s.status !== 'stock-shortage'),
    );
    if (!wave) return null;
    const snapshot = { status: wave.status, version: wave.version };
    return {
      wave,
      restore: () => {
        wave.status = snapshot.status;
        wave.version = snapshot.version;
      },
    };
  }

  describe('release', () => {
    it('publishes the orders that have stock and reports the rest', (done) => {
      const target = takePlannedWave();
      if (!target) {
        pending('no publishable wave in dataset');
        return;
      }

      const expectedShortages = waveOrderStatuses(target.wave.id).filter(
        (s) => s.status === 'stock-shortage',
      ).length;

      service.release(target.wave.id, target.wave.version).subscribe({
        next: (result) => {
          expect(result.wave.status).toBe('released');
          expect(result.failed.length).toBe(expectedShortages);
          expect(result.released.length + result.failed.length).toBe(target.wave.orderNumbers.length);
          // Every failure carries a reason the operator can act on.
          for (const failure of result.failed) {
            expect(failure.reason.length).toBeGreaterThan(0);
          }
          target.restore();
          done();
        },
        error: (err) => {
          target.restore();
          done.fail(err);
        },
      });
    });

    it('rejects a stale version with a conflict, not a silent overwrite', (done) => {
      const target = takePlannedWave();
      if (!target) {
        pending('no publishable wave in dataset');
        return;
      }
      const staleVersion = target.wave.version;
      // Simulate someone else editing the wave between the operator's read and their
      // publish click, without touching status — otherwise the status check would
      // fire first and mask the conflict this test is actually about.
      target.wave.version += 1;

      service.release(target.wave.id, staleVersion).subscribe({
        next: () => {
          target.restore();
          done.fail('expected a conflict on the stale version');
        },
        error: (err) => {
          expect(isApiError(err)).toBe(true);
          expect((err as ApiError).kind).toBe('conflict');
          target.restore();
          done();
        },
      });
    });

    it('refuses to publish a wave that is already released', (done) => {
      const released = db.waves.find((w) => w.status === 'released');
      if (!released) {
        pending('no released wave in dataset');
        return;
      }

      service.release(released.id, released.version).subscribe({
        next: () => done.fail('expected a validation error'),
        error: (err) => {
          expect((err as ApiError).kind).toBe('validation');
          done();
        },
      });
    });

    it('reports a not-found error for an unknown wave', (done) => {
      service.release('does-not-exist', 1).subscribe({
        next: () => done.fail('expected a not-found error'),
        error: (err) => {
          expect((err as ApiError).kind).toBe('not-found');
          done();
        },
      });
    });

    it('surfaces an injected transport failure instead of mutating the wave', (done) => {
      const target = takePlannedWave();
      if (!target) {
        pending('no publishable wave in dataset');
        return;
      }
      const statusBefore = target.wave.status;
      faults.armNextFailure('network');

      service.release(target.wave.id, target.wave.version).subscribe({
        next: () => {
          target.restore();
          done.fail('expected the armed failure to surface');
        },
        error: (err) => {
          expect((err as ApiError).kind).toBe('network');
          expect(target.wave.status).toBe(statusBefore);
          target.restore();
          done();
        },
      });
    });
  });

  describe('create', () => {
    it('rejects a duplicate wave name', (done) => {
      const existing = db.waves[0];

      service
        .create({
          name: existing.name,
          warehouseCode: existing.warehouseCode,
          carrier: existing.carrier,
          cutOffTime: '18:00',
          minPriority: 3,
          maxOrders: 5,
        })
        .subscribe({
          next: () => done.fail('expected a conflict'),
          error: (err) => {
            expect((err as ApiError).kind).toBe('conflict');
            done();
          },
        });
    });

    it('reports availability for a free name and a taken one', (done) => {
      service.isNameAvailable('Wave #does-not-exist').subscribe((free) => {
        expect(free).toBe(true);
        service.isNameAvailable(db.waves[0].name).subscribe((taken) => {
          expect(taken).toBe(false);
          done();
        });
      });
    });
  });

  describe('controlled order changes', () => {
    it('requires a reason when a released wave is changed', (done) => {
      const wave = db.waves.find((row) => row.status === 'released' && row.orderNumbers.length > 1);
      if (!wave) {
        pending('no released wave');
        return;
      }
      service.removeOrder(wave.id, wave.version, wave.orderNumbers[0]).subscribe({
        next: () => done.fail('expected a validation error'),
        error: (error) => {
          expect((error as ApiError).kind).toBe('validation');
          done();
        },
      });
    });
  });
});
