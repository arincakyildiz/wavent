import { StockStatus } from '../models/entities';

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
