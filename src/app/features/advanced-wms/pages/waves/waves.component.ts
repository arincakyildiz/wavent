import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WaveRow, WavesService } from '../../data-access/waves.service';

type LoadState = 'loading' | 'success' | 'error';
type StatusFilter = 'all' | WaveRow['status'];

@Component({
  selector: 'app-waves',
  imports: [],
  templateUrl: './waves.component.html',
  styleUrl: './waves.component.scss',
})
export class WavesComponent {
  private readonly wavesService = inject(WavesService);
  private readonly router = inject(Router);

  readonly state = signal<LoadState>('loading');
  readonly waves = signal<WaveRow[]>([]);
  readonly statusFilter = signal<StatusFilter>('all');

  readonly filtered = computed(() => {
    const f = this.statusFilter();
    return f === 'all' ? this.waves() : this.waves().filter((w) => w.status === f);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.wavesService.list().subscribe({
      next: (rows) => {
        this.waves.set(rows);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  open(id: string): void {
    this.router.navigate(['/wms/waves', id]);
  }

  statusTone(status: WaveRow['status']): string {
    const tone: Record<WaveRow['status'], string> = {
      draft: 'tone-neutral',
      planned: 'tone-info',
      released: 'tone-warning',
      completed: 'tone-success',
      cancelled: 'tone-danger',
    };
    return tone[status];
  }

  capacityTone(pct: number): string {
    if (pct >= 90) return 'tone-danger';
    if (pct >= 70) return 'tone-warning';
    return 'tone-success';
  }
}
