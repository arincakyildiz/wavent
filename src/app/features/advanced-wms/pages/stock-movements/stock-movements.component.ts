import { Component, computed, inject, signal } from '@angular/core';
import { MovementType, StockMovementRow, StockMovementsService } from '../../data-access/stock-movements.service';

type LoadState = 'loading' | 'success' | 'error';
type TypeFilter = 'all' | MovementType;

const PAGE_SIZE = 6;

@Component({
  selector: 'app-stock-movements',
  imports: [],
  templateUrl: './stock-movements.component.html',
  styleUrl: './stock-movements.component.scss',
})
export class StockMovementsComponent {
  private readonly movementsService = inject(StockMovementsService);

  readonly state = signal<LoadState>('loading');
  readonly rows = signal<StockMovementRow[]>([]);
  readonly search = signal('');
  readonly typeFilter = signal<TypeFilter>('all');
  readonly page = signal(1);

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const type = this.typeFilter();
    return this.rows().filter((r) => {
      const matchesTerm =
        !term || r.sku.toLowerCase().includes(term) || r.reasonCode.toLowerCase().includes(term);
      const matchesType = type === 'all' || r.type === type;
      return matchesTerm && matchesType;
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));

  readonly pageRows = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  readonly inboundTotal = computed(() =>
    this.rows().reduce((sum, r) => (r.quantity > 0 ? sum + r.quantity : sum), 0),
  );

  readonly outboundTotal = computed(() =>
    this.rows().reduce((sum, r) => (r.quantity < 0 ? sum + r.quantity : sum), 0),
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.movementsService.list().subscribe({
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

  onTypeChange(type: TypeFilter): void {
    this.typeFilter.set(type);
    this.page.set(1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  typeTone(type: MovementType): string {
    const tone: Record<MovementType, string> = {
      receipt: 'tone-success',
      putaway: 'tone-info',
      pick: 'tone-warning',
      adjustment: 'tone-danger',
      'cycle-count': 'tone-violet',
      shipment: 'tone-info',
    };
    return tone[type];
  }
}
