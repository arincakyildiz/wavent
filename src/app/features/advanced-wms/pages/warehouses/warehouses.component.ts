import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WarehousesService, WarehouseSummary } from '../../data-access/warehouses.service';

type LoadState = 'loading' | 'success' | 'error';
type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-warehouses',
  imports: [DecimalPipe],
  templateUrl: './warehouses.component.html',
  styleUrl: './warehouses.component.scss',
})
export class WarehousesComponent {
  private readonly warehousesService = inject(WarehousesService);

  readonly state = signal<LoadState>('loading');
  readonly warehouses = signal<WarehouseSummary[]>([]);
  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('all');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.warehouses().filter((w) => {
      const matchesTerm =
        !term ||
        w.name.toLowerCase().includes(term) ||
        w.code.toLowerCase().includes(term) ||
        w.city.toLowerCase().includes(term);
      const matchesStatus = status === 'all' || (status === 'active') === w.isActive;
      return matchesTerm && matchesStatus;
    });
  });

  readonly totalCapacityPct = computed(() => {
    const list = this.warehouses();
    if (!list.length) return 0;
    return Math.round(list.reduce((sum, w) => sum + w.capacityUsedPct, 0) / list.length);
  });

  readonly activeCount = computed(() => this.warehouses().filter((w) => w.isActive).length);

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.warehousesService.list().subscribe({
      next: (list) => {
        this.warehouses.set(list);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  capacityTone(pct: number): string {
    if (pct >= 85) return 'tone-danger';
    if (pct >= 65) return 'tone-warning';
    return 'tone-success';
  }
}
