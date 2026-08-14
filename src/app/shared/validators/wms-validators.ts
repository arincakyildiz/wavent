import {
  AbstractControl,
  AsyncValidatorFn,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, first, map, switchMap } from 'rxjs/operators';

/** Shared identifier formats used by both forms and write-boundary validation. */
export const WAREHOUSE_CODE_PATTERN = /^[A-Z]{2,4}-\d{2}$/;
export const SKU_CODE_PATTERN = /^SKU-[A-Z0-9]{3,8}$/;
export const ASN_NUMBER_PATTERN = /^ASN-\d{4}$/;
export const SALES_ORDER_NUMBER_PATTERN = /^SO-\d{4,8}$/;
export const CYCLE_COUNT_CODE_PATTERN = /^CC-\d{3}$/;
export const SERIAL_NUMBER_PATTERN = /^SN-[A-Z0-9-]{1,37}$/;
export const LOT_CODE_PATTERN = /^(?:L-\d{5}|LOT-[A-Z0-9]+(?:-[A-Z0-9]+)+)$/;
export const LOCATION_SEGMENT_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
export const LOCATION_PATH_PATTERN = /^(?:[A-Z0-9]+(?:-[A-Z0-9]+)*)(?:\/[A-Z0-9]+(?:-[A-Z0-9]+)*)*$/;
export const MIN_VOLUME_M3 = 0.0001;
export const MAX_VOLUME_M3 = 1000;

/** Minutes since midnight, or null when the value is not a HH:mm string. */
function toMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Cross-field: the closing time must come after the opening time.
 * Applied to the FormGroup, and mirrored onto the `close` control so the message can
 * render next to the field the operator needs to fix.
 */
export function operatingHoursRange(openKey = 'open', closeKey = 'close'): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const openControl = group.get(openKey);
    const closeControl = group.get(closeKey);
    if (!openControl || !closeControl) return null;

    const open = toMinutes(openControl.value);
    const close = toMinutes(closeControl.value);
    if (open === null || close === null) return null;

    const invalid = close <= open;

    const existing = closeControl.errors ?? {};
    if (invalid) {
      closeControl.setErrors({ ...existing, hoursRange: true });
    } else if (existing['hoursRange']) {
      const rest = { ...existing };
      delete rest['hoursRange'];
      closeControl.setErrors(Object.keys(rest).length ? rest : null);
    }

    return invalid ? { hoursRange: true } : null;
  };
}

/**
 * Cross-field: the cut-off must leave at least `minMinutes` of runway from now,
 * otherwise the wave cannot realistically be picked and shipped in time.
 */
export function cutOffRunway(cutOffKey: string, minMinutes: number, now: () => Date = () => new Date()): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const control = group.get(cutOffKey);
    const minutes = toMinutes(control?.value);
    if (minutes === null) return null;

    const current = now();
    const nowMinutes = current.getHours() * 60 + current.getMinutes();
    // A cut-off earlier in the day is treated as tomorrow's, so it always has runway.
    const runway = minutes >= nowMinutes ? minutes - nowMinutes : 24 * 60 - nowMinutes + minutes;
    const invalid = runway < minMinutes;

    const existing = control!.errors ?? {};
    if (invalid) {
      control!.setErrors({ ...existing, cutOffRunway: { minMinutes, runway } });
    } else if (existing['cutOffRunway']) {
      const rest = { ...existing };
      delete rest['cutOffRunway'];
      control!.setErrors(Object.keys(rest).length ? rest : null);
    }

    return invalid ? { cutOffRunway: { minMinutes, runway } } : null;
  };
}

/** Domain: warehouse/ASN style codes — uppercase letters, digits and dashes. */
export function codePattern(pattern: RegExp, errorKey = 'codePattern'): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null;
    return pattern.test(String(value).trim()) ? null : { [errorKey]: true };
  };
}

/** Domain: value must be a positive integer. */
export function positiveInteger(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === '' || value === undefined) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? null : { positiveInteger: true };
}

/**
 * Async uniqueness check against the backend. Debounced so typing does not fire a
 * request per keystroke, and `first()` completes the stream Angular is waiting on.
 */
export function uniqueValue(
  check: (value: string) => Observable<boolean>,
  errorKey = 'notUnique',
  debounceMs = 350,
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = String(control.value ?? '').trim();
    if (!value) return of(null);

    return of(value).pipe(
      debounceTime(debounceMs),
      switchMap((v) => check(v)),
      map((available) => (available ? null : { [errorKey]: true })),
      // A failed availability call must not block submission; the server re-checks.
      catchError(() => of(null)),
      first(),
    );
  };
}
