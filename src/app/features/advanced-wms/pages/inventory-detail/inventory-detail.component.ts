import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  InventoryLotRow,
  InventoryRow,
  InventoryService,
  LedgerEntry,
} from '../../data-access/inventory.service';
import { StockStatus } from '../../models/entities';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-inventory-detail',
  imports: [],
  templateUrl: './inventory-detail.component.html',
  styleUrl: './inventory-detail.component.scss',
})
export class InventoryDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryService);

  readonly state = signal<LoadState>('loading');
  readonly sku = signal('');
  readonly item = signal<InventoryRow | undefined>(undefined);
  readonly lots = signal<InventoryLotRow[]>([]);
  readonly ledger = signal<LedgerEntry[]>([]);

  constructor() {
    const sku = this.route.snapshot.paramMap.get('sku') ?? '';
    this.sku.set(sku);
    this.load(sku);
  }

  load(sku: string): void {
    this.state.set('loading');
    this.inventoryService.getBySku(sku).subscribe({
      next: (item) => {
        if (!item) {
          this.state.set('error');
          return;
        }
        this.item.set(item);
        this.inventoryService.getLots(sku).subscribe((lots) => this.lots.set(lots));
        this.inventoryService.getLedger(sku).subscribe((ledger) => this.ledger.set(ledger));
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  back(): void {
    this.router.navigate(['/wms/inventory']);
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
