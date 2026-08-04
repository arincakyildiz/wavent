import { ChangeDetectionStrategy, Component, input, inject } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';

/**
 * §9 InventoryLedger — stock movements with their running balance, so a quantity
 * can be traced back through the events that produced it.
 */

export interface LedgerEntry {
  id: string;
  date: string;
  type: string;
  /** Signed: negative for issues, positive for receipts. */
  quantity: number;
  runningBalance: number;
  reasonCode: string;
}

@Component({
  selector: 'app-inventory-ledger',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventory-ledger.component.html',
  styleUrl: './inventory-ledger.component.scss',
})
export class InventoryLedgerComponent {
  readonly i18n = inject(I18nService);
  readonly entries = input.required<LedgerEntry[]>();
  readonly emptyMessage = input('');
}
