import { Component, computed, inject, signal } from '@angular/core';
import { LotHealth, LotSerialRow, LotSerialService } from '../../data-access/lot-serial.service';

type LoadState = 'loading' | 'success' | 'error';
type HealthFilter = 'all' | LotHealth;

@Component({
  selector: 'app-lot-serial',
  imports: [],
  templateUrl: './lot-serial.component.html',
  styleUrl: './lot-serial.component.scss',
})
export class LotSerialComponent {
  private readonly lotSerialService = inject(LotSerialService);

  readonly state = signal<LoadState>('loading');
  readonly rows = signal<LotSerialRow[]>([]);
  readonly search = signal('');
  readonly healthFilter = signal<HealthFilter>('all');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const health = this.healthFilter();
    return this.rows().filter((r) => {
      const matchesTerm =
        !term ||
        r.lot.toLowerCase().includes(term) ||
        (r.serial?.toLowerCase().includes(term) ?? false) ||
        r.sku.toLowerCase().includes(term);
      const matchesHealth = health === 'all' || r.health === health;
      return matchesTerm && matchesHealth;
    });
  });

  readonly expiringCount = computed(() => this.rows().filter((r) => r.health === 'expiring').length);
  readonly blockedCount = computed(
    () => this.rows().filter((r) => r.health === 'blocked' || r.health === 'recalled').length,
  );
  readonly serialCount = computed(() => this.rows().filter((r) => !!r.serial).length);

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.lotSerialService.list().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  healthTone(health: LotHealth): string {
    const tone: Record<LotHealth, string> = {
      ok: 'tone-success',
      expiring: 'tone-warning',
      blocked: 'tone-danger',
      recalled: 'tone-danger',
    };
    return tone[health];
  }

  healthLabel(health: LotHealth): string {
    const label: Record<LotHealth, string> = {
      ok: 'Uygun',
      expiring: 'SKT Yaklaşıyor',
      blocked: 'Bloke',
      recalled: 'Geri Çağrıldı',
    };
    return label[health];
  }
}
