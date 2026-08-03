import { LocationClass, StockStatus } from '../models/entities';

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

const CLASS_LABEL: Record<LocationClass, string> = {
  ambient: 'Ambient',
  chilled: 'Soğuk',
  frozen: 'Donuk',
  hazmat: 'Tehlikeli madde',
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
    violations.push(`Ağırlık kapasitesi yetersiz (boşta ${round(free)} kg, gereken ${round(demand.weightKg)} kg)`);
  }

  if (slot.usedVolumeM3 + demand.volumeM3 > slot.maxVolumeM3) {
    const free = Math.max(0, slot.maxVolumeM3 - slot.usedVolumeM3);
    violations.push(`Hacim kapasitesi yetersiz (boşta ${round(free)} m³, gereken ${round(demand.volumeM3)} m³)`);
  }

  if (slot.locationClass !== demand.storageClass) {
    violations.push(
      `Ürün sınıfı uyumsuz (${CLASS_LABEL[demand.storageClass]} ürün, ${CLASS_LABEL[slot.locationClass]} lokasyon)`,
    );
  }

  const required = CLASS_TEMPERATURE_C[demand.storageClass];
  if (required) {
    const actual = slot.temperatureRangeC;
    if (!actual) {
      violations.push(`Lokasyon sıcaklık kontrollü değil (gereken ${required.min}°C…${required.max}°C)`);
    } else if (actual.min < required.min || actual.max > required.max) {
      violations.push(
        `Sıcaklık aralığı uygun değil (lokasyon ${actual.min}°C…${actual.max}°C, gereken ${required.min}°C…${required.max}°C)`,
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
        detail: `${unit.skuCode} seri takipli ama seri numarası yok`,
      });
      continue;
    }

    if (unit.quantity !== 1) {
      issues.push({
        kind: 'quantity',
        skuCode: unit.skuCode,
        serial: unit.serial,
        detail: `${unit.serial} ${unit.quantity} adet taşıyor; seri başına 1 birim olmalı`,
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
        detail: `${unit.serial} ${unit.skuCode} için birden fazla kayıtta kullanılmış`,
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
