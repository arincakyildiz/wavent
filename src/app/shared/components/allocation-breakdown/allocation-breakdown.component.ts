import { ChangeDetectionStrategy, Component, computed, input, output, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { I18nService } from '../../../core/i18n/i18n.service';

/**
 * §9 AllocationBreakdown — explains how a sales-order line was reserved: which
 * lot/location covers it, how much of the request is met, and which alternative
 * lots the operator could move it to.
 *
 * Presentational only. The input types are structural, so the feature's
 * `ReservationRow` / `LotCandidate` satisfy them without this component
 * depending on the WMS feature layer.
 */

export interface AllocationLine {
  sku: string;
  lot?: string;
  locationPath: string;
  quantity: number;
  requested: number;
  strategy: 'FEFO' | 'FIFO';
  overrideReason?: string;
}

export interface AllocationCandidate {
  lot?: string;
  locationPath: string;
  expiryDate?: string;
  freeQuantity: number;
  /** Set when picking this lot would skip an earlier-expiry one. */
  fefoViolationLot: string | null;
}

@Component({
  selector: 'app-allocation-breakdown',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './allocation-breakdown.component.html',
  styleUrl: './allocation-breakdown.component.scss',
})
export class AllocationBreakdownComponent {
  readonly i18n = inject(I18nService);
  readonly line = input.required<AllocationLine>();
  readonly candidates = input<AllocationCandidate[]>([]);
  readonly loading = input(false);
  /** Blocks selection while a write is in flight. */
  readonly busy = input(false);
  /** Emitted when the operator picks an alternative lot to re-allocate to. */
  readonly select = output<AllocationCandidate>();

  /** Share of the requested quantity this reservation actually covers. */
  readonly coveragePct = computed(() => {
    const l = this.line();
    if (!l.requested) return 0;
    return Math.min(100, Math.round((l.quantity / l.requested) * 100));
  });

  readonly shortfall = computed(() => Math.max(0, this.line().requested - this.line().quantity));

  choose(candidate: AllocationCandidate): void {
    if (this.busy()) return;
    this.select.emit(candidate);
  }
}
