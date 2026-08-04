import { ChangeDetectionStrategy, Component, computed, input, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { I18nService } from '../../../core/i18n/i18n.service';

/**
 * §9 WaveCapacityBoard — workload, operator capacity and cut-off risk for the waves
 * a shift is about to run, so a planner sees which wave will not make its cut-off
 * before publishing it.
 */

export interface WaveCapacityRow {
  id: string;
  name: string;
  warehouseCode: string;
  carrier: string;
  /** "HH:mm" */
  cutOffTime: string;
  orderCount: number;
  capacityUsedPct: number;
  status: string;
}

export type CutOffRisk = 'ok' | 'tight' | 'over';

export interface WaveCapacityView extends WaveCapacityRow {
  risk: CutOffRisk;
  minutesToCutOff: number;
  riskReason: string;
}

/** Below this many minutes of runway a wave is flagged as tight. */
const TIGHT_MINUTES = 90;
/** At or above this utilisation the shift cannot absorb more work. */
const OVER_CAPACITY_PCT = 90;

@Component({
  selector: 'app-wave-capacity-board',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wave-capacity-board.component.html',
  styleUrl: './wave-capacity-board.component.scss',
})
export class WaveCapacityBoardComponent {
  readonly i18n = inject(I18nService);
  readonly waves = input.required<WaveCapacityRow[]>();
  /** Injectable clock keeps the runway calculation testable. */
  readonly now = input<Date>(new Date());
  readonly emptyMessage = input('');

  readonly rows = computed<WaveCapacityView[]>(() => {
    const reference = this.now();
    const nowMinutes = reference.getHours() * 60 + reference.getMinutes();

    return this.waves()
      .map((wave) => {
        const minutesToCutOff = runwayMinutes(wave.cutOffTime, nowMinutes);
        const over = wave.capacityUsedPct >= OVER_CAPACITY_PCT;
        const tight = minutesToCutOff <= TIGHT_MINUTES;

        let risk: CutOffRisk = 'ok';
        let riskReason = this.i18n.t('board.reasonOk');

        if (over && tight) {
          risk = 'over';
          riskReason = this.i18n.t('board.reasonBoth', {
            pct: wave.capacityUsedPct,
            minutes: minutesToCutOff,
          });
        } else if (over) {
          risk = 'over';
          riskReason = this.i18n.t('board.reasonOver', { pct: wave.capacityUsedPct });
        } else if (tight) {
          risk = 'tight';
          riskReason = this.i18n.t('board.reasonTight', { minutes: minutesToCutOff });
        }

        return { ...wave, risk, minutesToCutOff, riskReason };
      })
      .sort((a, b) => a.minutesToCutOff - b.minutesToCutOff);
  });

  readonly totalOrders = computed(() => this.rows().reduce((s, w) => s + w.orderCount, 0));
  readonly atRiskCount = computed(() => this.rows().filter((w) => w.risk !== 'ok').length);

  /** Mean utilisation across the board — the shift-level load indicator. */
  readonly averageCapacity = computed(() => {
    const rows = this.rows();
    if (!rows.length) return 0;
    return Math.round(rows.reduce((s, w) => s + w.capacityUsedPct, 0) / rows.length);
  });

  riskTone(risk: CutOffRisk): string {
    const tone: Record<CutOffRisk, string> = {
      ok: 'tone-success',
      tight: 'tone-warning',
      over: 'tone-danger',
    };
    return tone[risk];
  }

  riskLabel(risk: CutOffRisk): string {
    const label: Record<CutOffRisk, string> = {
      ok: this.i18n.t('board.riskOk'),
      tight: this.i18n.t('board.riskTight'),
      over: this.i18n.t('board.riskOver'),
    };
    return label[risk];
  }

  capacityTone(pct: number): string {
    if (pct >= OVER_CAPACITY_PCT) return 'tone-danger';
    if (pct >= 70) return 'tone-warning';
    return 'tone-success';
  }
}

/** Minutes from now until a "HH:mm" cut-off; an earlier time counts as tomorrow's. */
function runwayMinutes(cutOff: string, nowMinutes: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(cutOff);
  if (!match) return Number.MAX_SAFE_INTEGER;

  const target = Number(match[1]) * 60 + Number(match[2]);
  return target >= nowMinutes ? target - nowMinutes : 24 * 60 - nowMinutes + target;
}
