import { Component, computed, inject, signal } from '@angular/core';
import { capacityPct, LocationRow, LocationsService } from '../../data-access/locations.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-locations',
  imports: [],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.scss',
})
export class LocationsComponent {
  private readonly locationsService = inject(LocationsService);

  readonly state = signal<LoadState>('loading');
  readonly locations = signal<LocationRow[]>([]);
  readonly search = signal('');
  readonly classFilter = signal<'all' | LocationRow['locationClass']>('all');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const cls = this.classFilter();
    return this.locations().filter((l) => {
      const matchesTerm = !term || l.path.toLowerCase().includes(term) || l.warehouseCode.toLowerCase().includes(term);
      const matchesClass = cls === 'all' || l.locationClass === cls;
      return matchesTerm && matchesClass;
    });
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.locationsService.list().subscribe({
      next: (list) => {
        this.locations.set(list);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  capacity(loc: LocationRow): number {
    return capacityPct(loc);
  }

  capacityTone(loc: LocationRow): string {
    const p = this.capacity(loc);
    if (p >= 90) return 'tone-danger';
    if (p >= 65) return 'tone-warning';
    return 'tone-success';
  }

  statusTone(status: LocationRow['status']): string {
    const tone: Record<LocationRow['status'], string> = {
      active: 'tone-success',
      full: 'tone-warning',
      blocked: 'tone-danger',
      inactive: 'tone-neutral',
    };
    return tone[status];
  }

  statusLabel(status: LocationRow['status']): string {
    const label: Record<LocationRow['status'], string> = {
      active: 'Aktif',
      full: 'Dolu',
      blocked: 'Bloke',
      inactive: 'Pasif',
    };
    return label[status];
  }
}
