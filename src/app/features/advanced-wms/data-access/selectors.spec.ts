import { StockStatus } from '../models/entities';
import { LocationRec, db } from './mock-data';
import {
  VARIANCE_THRESHOLD_PCT,
  capacityVerdict,
  fefoViolation,
  fitsCapacity,
  isReservable,
  networkTotals,
  requiresSecondCount,
  serialIssues,
  skuStock,
  stockIsBalanced,
  variancePct,
  waveOrderStatuses,
  withinWeightTolerance,
} from './selectors';

function makeLocation(overrides: Partial<LocationRec> = {}): LocationRec {
  return {
    id: 'loc-test',
    path: 'A/01/01',
    warehouseCode: 'NYC-01',
    type: 'bin',
    locationClass: 'ambient',
    status: 'active',
    maxWeightKg: 500,
    maxVolumeM3: 4,
    usedWeightKg: 400,
    usedVolumeM3: 3,
    ...overrides,
  };
}

describe('business rules (§10)', () => {
  describe('stock reservability', () => {
    it('allows only available stock to be reserved', () => {
      expect(isReservable(StockStatus.Available)).toBe(true);
    });

    it('refuses quarantine, damaged and blocked stock', () => {
      expect(isReservable(StockStatus.Quarantine)).toBe(false);
      expect(isReservable(StockStatus.Damaged)).toBe(false);
      expect(isReservable(StockStatus.Blocked)).toBe(false);
    });
  });

  describe('location capacity (§4)', () => {
    /** 1 kg / 0.01 m³ per unit of an ambient SKU, so quantity alone drives the limit. */
    const ambientSku = { weightKg: 1, volumeM3: 0.01, storageClass: 'ambient' as const };

    it('accepts a putaway that stays within every limit', () => {
      expect(fitsCapacity(makeLocation({ usedWeightKg: 400 }), ambientSku, 100)).toBe(true);
    });

    it('rejects a putaway that exceeds the weight limit', () => {
      expect(fitsCapacity(makeLocation({ usedWeightKg: 400 }), ambientSku, 101)).toBe(false);
    });

    it('rejects a bulky-but-light putaway on volume even when weight fits', () => {
      const bulky = { weightKg: 0.1, volumeM3: 0.5, storageClass: 'ambient' as const };
      const loc = makeLocation({ usedWeightKg: 0, usedVolumeM3: 3, maxVolumeM3: 4 });

      const verdict = capacityVerdict(loc, bulky, 4);
      expect(verdict.ok).toBe(false);
      expect(verdict.violations.join(' ')).toContain('Hacim');
    });

    it('refuses a product class the location does not hold', () => {
      const frozenSku = { weightKg: 1, volumeM3: 0.01, storageClass: 'frozen' as const };
      const verdict = capacityVerdict(makeLocation({ locationClass: 'ambient' }), frozenSku, 1);

      expect(verdict.ok).toBe(false);
      expect(verdict.violations.join(' ')).toContain('Ürün sınıfı');
    });

    it('refuses a chilled SKU in a bin whose temperature band is too wide', () => {
      const chilledSku = { weightKg: 1, volumeM3: 0.01, storageClass: 'chilled' as const };
      const tooWarm = makeLocation({
        locationClass: 'chilled',
        temperatureRangeC: { min: 0, max: 15 },
      });

      const verdict = capacityVerdict(tooWarm, chilledSku, 1);
      expect(verdict.ok).toBe(false);
      expect(verdict.violations.join(' ')).toContain('Sıcaklık');
    });

    it('accepts a chilled SKU in a correctly-banded chilled bin', () => {
      const chilledSku = { weightKg: 1, volumeM3: 0.01, storageClass: 'chilled' as const };
      const chilledBin = makeLocation({
        locationClass: 'chilled',
        temperatureRangeC: { min: 2, max: 6 },
      });

      expect(capacityVerdict(chilledBin, chilledSku, 1).ok).toBe(true);
    });

    it('reports every failing constraint at once rather than short-circuiting', () => {
      const frozenSku = { weightKg: 100, volumeM3: 1, storageClass: 'frozen' as const };
      const verdict = capacityVerdict(makeLocation({ locationClass: 'ambient' }), frozenSku, 10);

      // over weight, over volume, wrong class, and the bin has no temperature control
      expect(verdict.violations.length).toBe(4);
    });
  });

  describe('serial uniqueness (§10)', () => {
    /** Only SKU-S is serial-tracked in these cases. */
    const tracked = (code: string) => code === 'SKU-S';

    it('accepts one unit per unique serial', () => {
      const issues = serialIssues(
        [
          { skuCode: 'SKU-S', serial: 'SN-1', quantity: 1 },
          { skuCode: 'SKU-S', serial: 'SN-2', quantity: 1 },
        ],
        tracked,
      );
      expect(issues).toEqual([]);
    });

    it('flags a serial reused across two records', () => {
      const issues = serialIssues(
        [
          { skuCode: 'SKU-S', serial: 'SN-1', quantity: 1 },
          { skuCode: 'SKU-S', serial: 'SN-1', quantity: 1 },
        ],
        tracked,
      );
      expect(issues.length).toBe(1);
      expect(issues[0].kind).toBe('duplicate');
    });

    it('flags a serial-tracked unit with no serial at all', () => {
      const issues = serialIssues([{ skuCode: 'SKU-S', quantity: 1 }], tracked);
      expect(issues.length).toBe(1);
      expect(issues[0].kind).toBe('missing');
    });

    it('flags a serial that carries more than one unit', () => {
      const issues = serialIssues([{ skuCode: 'SKU-S', serial: 'SN-1', quantity: 4 }], tracked);
      expect(issues.length).toBe(1);
      expect(issues[0].kind).toBe('quantity');
    });

    it('ignores SKUs that are not serial-tracked', () => {
      const issues = serialIssues(
        [
          { skuCode: 'SKU-BULK', quantity: 500 },
          { skuCode: 'SKU-BULK', quantity: 500 },
        ],
        tracked,
      );
      expect(issues).toEqual([]);
    });

    it('treats the same serial on different SKUs as distinct', () => {
      const issues = serialIssues(
        [
          { skuCode: 'SKU-S', serial: 'SN-1', quantity: 1 },
          { skuCode: 'SKU-OTHER', serial: 'SN-1', quantity: 1 },
        ],
        (code) => code === 'SKU-S' || code === 'SKU-OTHER',
      );
      expect(issues).toEqual([]);
    });
  });

  describe('FEFO', () => {
    const candidates = [
      { lot: 'L-EARLY', expiryDate: '2026-08-01' },
      { lot: 'L-LATE', expiryDate: '2026-12-01' },
    ];

    it('flags the earlier lot when a later one was chosen', () => {
      expect(fefoViolation({ lot: 'L-LATE', expiryDate: '2026-12-01' }, candidates)).toBe('L-EARLY');
    });

    it('reports no violation when the earliest lot was chosen', () => {
      expect(fefoViolation({ lot: 'L-EARLY', expiryDate: '2026-08-01' }, candidates)).toBeNull();
    });

    it('does not apply to SKUs without an expiry date', () => {
      expect(fefoViolation({ lot: 'L-NONE' }, candidates)).toBeNull();
    });
  });

  describe('cycle count variance', () => {
    it('computes the absolute variance percentage', () => {
      expect(variancePct(1000, 950)).toBeCloseTo(5);
      expect(variancePct(1000, 1050)).toBeCloseTo(5);
    });

    it('requires a second count above the threshold', () => {
      expect(requiresSecondCount(1000, 950)).toBe(true);
    });

    it('does not require a second count at or below the threshold', () => {
      expect(requiresSecondCount(1000, 1000 - VARIANCE_THRESHOLD_PCT * 10)).toBe(false);
    });

    it('treats a zero expectation as no variance', () => {
      expect(variancePct(0, 0)).toBe(0);
    });
  });

  describe('package weight tolerance', () => {
    it('accepts a package inside tolerance', () => {
      expect(withinWeightTolerance({ weightKg: 4.2, expectedWeightKg: 4.0, toleranceKg: 0.3 })).toBe(true);
    });

    it('rejects a package outside tolerance in either direction', () => {
      expect(withinWeightTolerance({ weightKg: 4.5, expectedWeightKg: 4.0, toleranceKg: 0.3 })).toBe(false);
      expect(withinWeightTolerance({ weightKg: 3.5, expectedWeightKg: 4.0, toleranceKg: 0.3 })).toBe(false);
    });
  });
});

describe('stock derivations', () => {
  it('keeps on-hand equal to the sum of its status buckets for every SKU', () => {
    const rows = skuStock();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(stockIsBalanced(row)).toBe(true);
    }
  });

  it('never reports more available than on-hand', () => {
    for (const row of skuStock()) {
      expect(row.available).toBeLessThanOrEqual(row.onHand);
    }
  });

  it('narrows totals when a warehouse scope is applied', () => {
    const all = networkTotals();
    const single = networkTotals(['NYC-01']);
    expect(single.onHand).toBeLessThanOrEqual(all.onHand);
    expect(single.onHand).toBeGreaterThan(0);
  });

  it('matches the network total against the sum of per-warehouse totals', () => {
    const codes = db.warehouses.map((w) => w.code);
    const summed = codes.reduce((sum, code) => sum + networkTotals([code]).onHand, 0);
    expect(summed).toBe(networkTotals().onHand);
  });
});

describe('wave publish verdicts', () => {
  it('returns one verdict per order on the wave', () => {
    const wave = db.waves[0];
    const statuses = waveOrderStatuses(wave.id);
    expect(statuses.length).toBe(wave.orderNumbers.length);
  });

  it('marks orders with an unfulfilled allocation as short on stock', () => {
    const waveWithShortage = db.waves.find((w) =>
      w.orderNumbers.some((number) =>
        db.allocations.some((a) => a.orderNumber === number && (a.isBackorder || a.isPartial)),
      ),
    );

    // The generated dataset always contains at least one shortage; guard anyway.
    if (!waveWithShortage) {
      pending('dataset contained no shortage');
      return;
    }

    const statuses = waveOrderStatuses(waveWithShortage.id);
    expect(statuses.some((s) => s.status === 'stock-shortage')).toBe(true);
  });

  it('returns nothing for an unknown wave', () => {
    expect(waveOrderStatuses('does-not-exist')).toEqual([]);
  });
});
