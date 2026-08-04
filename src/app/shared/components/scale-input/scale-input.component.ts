import { DestroyRef, Component, computed, inject, input, output, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { I18nService } from '../../../core/i18n/i18n.service';

/**
 * §2 ScaleInput — simulates reading a package weight off a bench scale.
 *
 * A real scale does not answer instantly: the load cell oscillates and only settles
 * after a moment, and the reading carries a small calibration offset. Both matter
 * operationally, so both are modelled — an unsettled reading cannot be committed,
 * which is what stops an operator from recording a number the scale was still
 * swinging through.
 */

/** How long the load cell oscillates before the reading settles. */
const SETTLE_MS = 1200;
/** Interval between intermediate (unstable) readings. */
const TICK_MS = 150;
/** Worst-case calibration offset, in kg — small but enough to matter at tolerance edges. */
const CALIBRATION_DRIFT_KG = 0.4;
/** How wildly the reading swings before settling, in kg. */
const SETTLE_SWING_KG = 3.5;

export type ScaleState = 'idle' | 'weighing' | 'stable';

@Component({
  selector: 'app-scale-input',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './scale-input.component.html',
  styleUrl: './scale-input.component.scss',
})
export class ScaleInputComponent {
  readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** The true weight the scale is measuring; the simulation deviates around it. */
  readonly actualWeightKg = input.required<number>();
  readonly label = input('');
  readonly disabled = input(false);

  /** Emitted only once the reading has settled. */
  readonly weighed = output<number>();

  readonly state = signal<ScaleState>('idle');
  readonly reading = signal<number | null>(null);

  readonly isWeighing = computed(() => this.state() === 'weighing');
  readonly canCommit = computed(() => this.state() === 'stable' && !this.disabled());

  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimers());
  }

  /** Starts a weighing cycle: unstable readings, then a settled value. */
  weigh(): void {
    if (this.disabled() || this.isWeighing()) return;

    this.clearTimers();
    this.state.set('weighing');

    const target = this.settledValue();
    const elapsedTicks = Math.floor(SETTLE_MS / TICK_MS);

    for (let tick = 1; tick <= elapsedTicks; tick++) {
      const timer = setTimeout(() => {
        // Swing decays as the load cell settles, so the display converges visibly.
        const decay = 1 - tick / elapsedTicks;
        const swing = (Math.random() - 0.5) * 2 * SETTLE_SWING_KG * decay;
        this.reading.set(round(target + swing));
      }, tick * TICK_MS);
      this.timers.push(timer);
    }

    const settle = setTimeout(() => {
      this.reading.set(target);
      this.state.set('stable');
    }, SETTLE_MS + TICK_MS);
    this.timers.push(settle);
  }

  /** Hands the settled reading to the caller. */
  commit(): void {
    const value = this.reading();
    if (!this.canCommit() || value === null) return;

    this.weighed.emit(value);
    this.reset();
  }

  reset(): void {
    this.clearTimers();
    this.state.set('idle');
    this.reading.set(null);
  }

  /** True weight plus the calibration offset a bench scale carries. */
  private settledValue(): number {
    const drift = (Math.random() - 0.5) * 2 * CALIBRATION_DRIFT_KG;
    return round(Math.max(0, this.actualWeightKg() + drift));
  }

  private clearTimers(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
