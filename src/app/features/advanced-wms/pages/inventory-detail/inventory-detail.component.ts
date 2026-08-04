import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { describeError } from '../../../../core/api/api-error';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InventoryLedgerComponent } from '../../../../shared/components/inventory-ledger/inventory-ledger.component';
import { StockStatus } from '../../models/entities';
import {
  InventoryLotRow,
  InventoryRow,
  InventoryService,
  LedgerEntry,
} from '../../data-access/inventory.service';
import { stockIsBalanced } from '../../data-access/selectors';
import { I18nService } from '../../../../core/i18n/i18n.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-inventory-detail',
  imports: [IconComponent, InventoryLedgerComponent],
  templateUrl: './inventory-detail.component.html',
  styleUrl: './inventory-detail.component.scss',
})
export class InventoryDetailComponent {
  readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryService);
  private readonly scope = inject(WarehouseScopeService);

  readonly state = signal<LoadState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly sku = signal('');
  readonly item = signal<InventoryRow | undefined>(undefined);
  readonly lots = signal<InventoryLotRow[]>([]);
  readonly ledger = signal<LedgerEntry[]>([]);

  /** Surfaces the on-hand = sum(buckets) invariant instead of assuming it. */
  readonly balanced = computed(() => {
    const item = this.item();
    return item ? stockIsBalanced(item) : true;
  });

  constructor() {
    const sku = this.route.snapshot.paramMap.get('sku') ?? '';
    this.sku.set(sku);
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set(null);
    const scope = this.scope.activeCodes();

    this.inventoryService.getBySku(this.sku(), scope).subscribe({
      next: (item) => {
        this.item.set(item);
        this.inventoryService.getLots(this.sku(), scope).subscribe((lots) => this.lots.set(lots));
        this.inventoryService.getLedger(this.sku(), scope).subscribe((ledger) => this.ledger.set(ledger));
        this.state.set('success');
      },
      error: (err) => {
        this.errorMessage.set(describeError(err));
        this.state.set('error');
      },
    });
  }

  back(): void {
    this.router.navigate(['/wms/inventory']);
  }

  /** The browser's own print pipeline is the PDF export — "Save as PDF" in the print dialog. */
  downloadPdf(): void {
    window.print();
  }

  statusTone(status: StockStatus): string {
    const tone: Record<StockStatus, string> = {
      [StockStatus.Available]: 'tone-success',
      [StockStatus.Reserved]: 'tone-info',
      [StockStatus.Quarantine]: 'tone-warning',
      [StockStatus.Damaged]: 'tone-danger',
      [StockStatus.Blocked]: 'tone-danger',
    };
    return tone[status];
  }
}
