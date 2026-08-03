import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ScaleInputComponent } from './scale-input.component';

/**
 * §2 device simulation. The point of modelling settling time is that an operator
 * must not be able to commit a number the load cell was still swinging through, so
 * that is what these specs pin down.
 */
describe('ScaleInputComponent', () => {
  let fixture: ComponentFixture<ScaleInputComponent>;
  let component: ScaleInputComponent;

  const ACTUAL_KG = 20;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ScaleInputComponent] }).compileComponents();

    fixture = TestBed.createComponent(ScaleInputComponent);
    fixture.componentRef.setInput('actualWeightKg', ACTUAL_KG);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts idle with no reading', () => {
    expect(component.state()).toBe('idle');
    expect(component.reading()).toBeNull();
    expect(component.canCommit()).toBe(false);
  });

  it('reports an unstable reading while the load cell settles', fakeAsync(() => {
    component.weigh();
    tick(300);

    expect(component.state()).toBe('weighing');
    expect(component.reading()).not.toBeNull();
    // The value is moving, so it must not be committable yet.
    expect(component.canCommit()).toBe(false);

    tick(5000);
  }));

  it('settles on a stable reading close to the real weight', fakeAsync(() => {
    component.weigh();
    tick(5000);

    expect(component.state()).toBe('stable');
    expect(component.canCommit()).toBe(true);

    // Calibration drift is bounded, so the settled value stays near the truth.
    expect(Math.abs(component.reading()! - ACTUAL_KG)).toBeLessThanOrEqual(0.5);
  }));

  it('emits only the settled reading', fakeAsync(() => {
    const emitted: number[] = [];
    component.weighed.subscribe((value) => emitted.push(value));

    component.weigh();

    // Committing mid-swing is refused.
    tick(300);
    component.commit();
    expect(emitted.length).toBe(0);

    tick(5000);
    const settled = component.reading()!;
    component.commit();

    expect(emitted).toEqual([settled]);
  }));

  it('returns to idle after committing, ready for the next package', fakeAsync(() => {
    component.weigh();
    tick(5000);
    component.commit();

    expect(component.state()).toBe('idle');
    expect(component.reading()).toBeNull();
  }));

  it('ignores a weigh request while one is already running', fakeAsync(() => {
    component.weigh();
    tick(300);
    const midSwing = component.reading();

    component.weigh();
    tick(1);
    // The second call was a no-op; the first cycle is still the one in progress.
    expect(component.state()).toBe('weighing');
    expect(component.reading()).toBe(midSwing);

    tick(5000);
    expect(component.state()).toBe('stable');
  }));

  it('does nothing when disabled', fakeAsync(() => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    component.weigh();
    tick(5000);

    expect(component.state()).toBe('idle');
    expect(component.reading()).toBeNull();
  }));
});
