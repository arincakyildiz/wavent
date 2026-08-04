import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WAVE_LIMITS, WaveFormComponent } from './wave-form.component';

/**
 * The bounds used to live only as `max="40"` HTML attributes, which the spinner
 * respects but a typed value does not. These specs pin the rule to the form itself,
 * so an out-of-range value is rejected however it was entered.
 */
describe('WaveFormComponent — field limits', () => {
  let component: WaveFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WaveFormComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    component = TestBed.createComponent(WaveFormComponent).componentInstance;
  });

  describe('maks. sipariş', () => {
    it('accepts a value inside the range', () => {
      component.form.controls.maxOrders.setValue(WAVE_LIMITS.ordersMax);
      expect(component.form.controls.maxOrders.valid).toBe(true);
    });

    it('rejects a typed value above the limit', () => {
      component.form.controls.maxOrders.setValue(WAVE_LIMITS.ordersMax + 1);

      expect(component.form.controls.maxOrders.valid).toBe(false);
      expect(component.form.controls.maxOrders.hasError('max')).toBe(true);
    });

    it('rejects zero and negatives', () => {
      component.form.controls.maxOrders.setValue(0);
      expect(component.form.controls.maxOrders.valid).toBe(false);

      component.form.controls.maxOrders.setValue(-5);
      expect(component.form.controls.maxOrders.valid).toBe(false);
    });
  });

  describe('en düşük öncelik', () => {
    it('accepts a value inside the range', () => {
      component.form.controls.minPriority.setValue(WAVE_LIMITS.priorityMax);
      expect(component.form.controls.minPriority.valid).toBe(true);
    });

    it('rejects a priority above the range orders actually use', () => {
      component.form.controls.minPriority.setValue(WAVE_LIMITS.priorityMax + 1);

      expect(component.form.controls.minPriority.valid).toBe(false);
      expect(component.form.controls.minPriority.hasError('max')).toBe(true);
    });
  });

  it('blocks submission while a limit is exceeded', () => {
    const emitted: unknown[] = [];
    component.created.subscribe((v) => emitted.push(v));

    component.form.patchValue({
      name: 'Wave #999',
      maxOrders: WAVE_LIMITS.ordersMax + 100,
    });

    component.submit();

    // Nothing is created, and the offending control is the one carrying the error.
    // (The group itself reports PENDING here, because the name field's async
    // uniqueness check outranks INVALID in Angular's status calculation.)
    expect(emitted.length).toBe(0);
    expect(component.form.controls.maxOrders.hasError('max')).toBe(true);
  });

  it('exposes the limits to the template so they can be shown up front', () => {
    // The hint text is driven by these, so they must be reachable from the view.
    expect(component.limits.ordersMax).toBe(WAVE_LIMITS.ordersMax);
    expect(component.limits.priorityMax).toBe(WAVE_LIMITS.priorityMax);
  });
});
