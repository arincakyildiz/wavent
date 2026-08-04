import { LocationClass, StockStatus } from '../models/entities';
import { translate } from '../../../core/i18n/i18n.service';

/**
 * Pure rules with no dependency on the seeded `db`, so both the allocation engine
 * (`mock-data.ts`) and the derivation layer (`selectors.ts`) can share one
 * implementation without a circular import between them.
 */

/** §10: quarantine / damaged / blocked stock may never be reserved to an order. */
export function isReservable(status: StockStatus): boolean {
  return status === StockStatus.Available;
}

/**
 * §10: for shelf-life SKUs, an earlier-expiry lot must be consumed first. Returns the
 * lot that should have been picked when the choice breaks FEFO, otherwise null.
 */
export function fefoViolation(
  chosen: { lot?: string; expiryDate?: string },
  candidates: { lot?: string; expiryDate?: string }[],
): string | null {
  if (!chosen.expiryDate) return null;
  const earlier = candidates
    .filter((c) => c.expiryDate && c.expiryDate < chosen.expiryDate! && c.lot !== chosen.lot)
    .sort((a, b) => a.expiryDate!.localeCompare(b.expiryDate!))[0];
  return earlier?.lot ?? null;
}

/* ------------------------------------------------------------------ *
 * §4 / §12: location capacity — weight, volume, product class, temperature
 * ------------------------------------------------------------------ */

/** The band a storage class has to be held in; ambient/hazmat are not temperature-bound. */
export const CLASS_TEMPERATURE_C: Record<LocationClass, { min: number; max: number } | null> = {
  ambient: null,
  chilled: { min: 0, max: 8 },
  frozen: { min: -25, max: -18 },
  hazmat: null,
};

/** Catalog keys, resolved when a violation message is built. */
const CLASS_LABEL: Record<LocationClass, string> = {
  ambient: 'class.ambient',
  chilled: 'class.chilled',
  frozen: 'class.frozen',
  hazmat: 'class.hazmat',
};

/** The capacity-bearing side: a bin and what it is already holding. */
export interface CapacitySlot {
  locationClass: LocationClass;
  maxWeightKg: number;
  usedWeightKg: number;
  maxVolumeM3: number;
  usedVolumeM3: number;
  temperatureRangeC?: { min: number; max: number };
}

/** What we are trying to put into that bin. */
export interface CapacityDemand {
  weightKg: number;
  volumeM3: number;
  storageClass: LocationClass;
}

export interface CapacityVerdict {
  ok: boolean;
  /** Human-readable reasons, so Putaway can explain *why* a suggestion is blocked. */
  violations: string[];
}

/**
 * §4: a location's capacity is validated on weight, volume, product class and
 * temperature — not weight alone. Returns every failing constraint rather than
 * short-circuiting, so the UI can list all of them at once (§12).
 */
export function checkCapacity(slot: CapacitySlot, demand: CapacityDemand): CapacityVerdict {
  const violations: string[] = [];

  if (slot.usedWeightKg + demand.weightKg > slot.maxWeightKg) {
    const free = Math.max(0, slot.maxWeightKg - slot.usedWeightKg);
    violations.push(translate('rule.weightCapacity', { free: round(free), needed: round(demand.weightKg) }));
  }

  if (slot.usedVolumeM3 + demand.volumeM3 > slot.maxVolumeM3) {
    const free = Math.max(0, slot.maxVolumeM3 - slot.usedVolumeM3);
    violations.push(translate('rule.volumeCapacity', { free: round(free), needed: round(demand.volumeM3) }));
  }

  if (slot.locationClass !== demand.storageClass) {
    violations.push(
      translate('rule.classMismatch', {
        product: translate(CLASS_LABEL[demand.storageClass]),
        location: translate(CLASS_LABEL[slot.locationClass]),
      }),
    );
  }

  const required = CLASS_TEMPERATURE_C[demand.storageClass];
  if (required) {
    const actual = slot.temperatureRangeC;
    if (!actual) {
      violations.push(translate('rule.notTempControlled', { min: required.min, max: required.max }));
    } else if (actual.min < required.min || actual.max > required.max) {
      violations.push(
        translate('rule.tempOutOfRange', {
        actualMin: actual.min,
        actualMax: actual.max,
        min: required.min,
        max: required.max,
      }),
      );
    }
  }

  return { ok: violations.length === 0, violations };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/* ------------------------------------------------------------------ *
 * §10: serial-tracked SKUs need one unique serial per unit
 * ------------------------------------------------------------------ */

/** A stock unit as far as the serial rule is concerned. */
export interface SerialUnit {
  skuCode: string;
  serial?: string;
  quantity: number;
}

export type SerialIssue =
  | { kind: 'missing'; skuCode: string; detail: string }
  | { kind: 'quantity'; skuCode: string; serial: string; detail: string }
  | { kind: 'duplicate'; skuCode: string; serial: string; detail: string };

/**
 * §10: for a serial-tracked SKU every unit carries its own serial, so each record
 * must have a serial, hold exactly one unit, and never repeat a serial. Checked over
 * a whole set rather than per row, because duplication is only visible in aggregate.
 */
export function serialIssues(units: SerialUnit[], isSerialTracked: (skuCode: string) => boolean): SerialIssue[] {
  const issues: SerialIssue[] = [];
  const seen = new Map<string, number>();

  for (const unit of units) {
    if (!isSerialTracked(unit.skuCode)) continue;

    if (!unit.serial) {
      issues.push({
        kind: 'missing',
        skuCode: unit.skuCode,
        detail: translate('rule.serialMissing', { code: unit.skuCode }),
      });
      continue;
    }

    if (unit.quantity !== 1) {
      issues.push({
        kind: 'quantity',
        skuCode: unit.skuCode,
        serial: unit.serial,
        detail: translate('rule.serialQuantity', { serial: unit.serial, quantity: unit.quantity }),
      });
    }

    // Serials are unique per SKU, so the same number may legitimately recur
    // across different products.
    const key = `${unit.skuCode}::${unit.serial}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);

    if (count === 2) {
      issues.push({
        kind: 'duplicate',
        skuCode: unit.skuCode,
        serial: unit.serial,
        detail: translate('rule.serialDuplicate', { serial: unit.serial, code: unit.skuCode }),
      });
    }
  }

  return issues;
}

/** True when no unit breaks the serial rule. */
export function serialsAreUnique(
  units: SerialUnit[],
  isSerialTracked: (skuCode: string) => boolean,
): boolean {
  return serialIssues(units, isSerialTracked).length === 0;
}
