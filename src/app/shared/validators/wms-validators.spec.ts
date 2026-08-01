import { FormControl, FormGroup } from '@angular/forms';
import { of, throwError } from 'rxjs';
import {
  codePattern,
  cutOffRunway,
  operatingHoursRange,
  positiveInteger,
  uniqueValue,
} from './wms-validators';

describe('operatingHoursRange (cross-field)', () => {
  function group(open: string, close: string): FormGroup {
    return new FormGroup(
      { open: new FormControl(open), close: new FormControl(close) },
      { validators: [operatingHoursRange()] },
    );
  }

  it('accepts a close time after the open time', () => {
    const g = group('06:00', '22:00');
    expect(g.errors).toBeNull();
    expect(g.controls['close'].hasError('hoursRange')).toBe(false);
  });

  it('rejects a close time before the open time', () => {
    const g = group('18:00', '09:00');
    expect(g.hasError('hoursRange')).toBe(true);
    // Mirrored onto the field so the message renders where it can be fixed.
    expect(g.controls['close'].hasError('hoursRange')).toBe(true);
  });

  it('rejects equal open and close times', () => {
    expect(group('08:00', '08:00').hasError('hoursRange')).toBe(true);
  });

  it('clears the field error once the range becomes valid', () => {
    const g = group('18:00', '09:00');
    expect(g.controls['close'].hasError('hoursRange')).toBe(true);

    g.controls['close'].setValue('23:00');
    g.updateValueAndValidity();
    expect(g.controls['close'].hasError('hoursRange')).toBe(false);
  });

  it('stays neutral while a time is still incomplete', () => {
    expect(group('', '22:00').errors).toBeNull();
  });
});

describe('cutOffRunway (cross-field)', () => {
  const at = (hours: number, minutes: number) => () => new Date(2026, 6, 30, hours, minutes);

  function group(cutOff: string, now: () => Date): FormGroup {
    return new FormGroup(
      { cutOffTime: new FormControl(cutOff) },
      { validators: [cutOffRunway('cutOffTime', 45, now)] },
    );
  }

  it('accepts a cut-off with enough runway', () => {
    expect(group('16:00', at(10, 0)).errors).toBeNull();
  });

  it('rejects a cut-off that is too close', () => {
    expect(group('10:20', at(10, 0)).hasError('cutOffRunway')).toBe(true);
  });

  it('treats an earlier cut-off as tomorrow, so it has runway', () => {
    expect(group('06:00', at(22, 0)).errors).toBeNull();
  });
});

describe('codePattern', () => {
  const control = (value: string) => new FormControl(value);
  const validator = codePattern(/^[A-Z]{2,4}-\d{2}$/);

  it('accepts a well-formed code', () => {
    expect(validator(control('IST-02'))).toBeNull();
  });

  it('rejects a malformed code', () => {
    expect(validator(control('ist-2'))).toEqual({ codePattern: true });
  });

  it('stays neutral on an empty value so `required` owns that message', () => {
    expect(validator(control(''))).toBeNull();
  });
});

describe('positiveInteger', () => {
  it('accepts positive integers', () => {
    expect(positiveInteger(new FormControl(5))).toBeNull();
  });

  it('rejects zero, negatives and fractions', () => {
    expect(positiveInteger(new FormControl(0))).toEqual({ positiveInteger: true });
    expect(positiveInteger(new FormControl(-3))).toEqual({ positiveInteger: true });
    expect(positiveInteger(new FormControl(2.5))).toEqual({ positiveInteger: true });
  });

  it('stays neutral on an empty value', () => {
    expect(positiveInteger(new FormControl(''))).toBeNull();
  });
});

describe('uniqueValue (async)', () => {
  it('passes when the backend says the value is free', (done) => {
    const validator = uniqueValue(() => of(true), 'notUnique', 0);
    (validator(new FormControl('IST-02')) as ReturnType<typeof of>).subscribe((result) => {
      expect(result).toBeNull();
      done();
    });
  });

  it('fails when the backend says the value is taken', (done) => {
    const validator = uniqueValue(() => of(false), 'notUnique', 0);
    (validator(new FormControl('NYC-01')) as ReturnType<typeof of>).subscribe((result) => {
      expect(result).toEqual({ notUnique: true });
      done();
    });
  });

  it('does not block submission when the availability call fails', (done) => {
    const validator = uniqueValue(() => throwError(() => new Error('offline')), 'notUnique', 0);
    (validator(new FormControl('IST-02')) as ReturnType<typeof of>).subscribe((result) => {
      expect(result).toBeNull();
      done();
    });
  });

  it('skips the call for an empty value', (done) => {
    let called = false;
    const validator = uniqueValue(() => {
      called = true;
      return of(true);
    }, 'notUnique', 0);

    (validator(new FormControl('')) as ReturnType<typeof of>).subscribe((result) => {
      expect(result).toBeNull();
      expect(called).toBe(false);
      done();
    });
  });
});
