import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryRow, InventoryService } from '../../data-access/inventory.service';

type LoadState = 'loading' | 'success' | 'error';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-inventory',
  imports: [],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
})
export class InventoryComponent {
  private readonly inventoryService = inject(InventoryService);
  private readonly router = inject(Router);

  readonly state = signal<LoadState>('loading');
  readonly rows = signal<InventoryRow[]>([]);
  readonly search = signal('');
  readonly page = signal(1);

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter(
      (r) => r.sku.toLowerCase().includes(term) || r.name.toLowerCase().includes(term),
    );
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));

  readonly pageRows = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.inventoryService.list().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  onSearch(term: string): void {
    this.search.set(term);
    this.page.set(1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  openDetail(sku: string): void {
    this.router.navigate(['/wms/inventory', sku]);
  }

  availabilityPct(row: InventoryRow): number {
    return row.totalOnHand ? Math.round((row.available / row.totalOnHand) * 100) : 0;
  }
}
