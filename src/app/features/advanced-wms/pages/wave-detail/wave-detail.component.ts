import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WaveOrderRow, WaveRow, WavesService } from '../../data-access/waves.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-wave-detail',
  imports: [],
  templateUrl: './wave-detail.component.html',
  styleUrl: './wave-detail.component.scss',
})
export class WaveDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly wavesService = inject(WavesService);

  readonly state = signal<LoadState>('loading');
  readonly wave = signal<WaveRow | undefined>(undefined);
  readonly orders = signal<WaveOrderRow[]>([]);
  readonly releasing = signal(false);

  readonly riskyCount = computed(
    () => this.orders().filter((o) => o.status !== 'ok').length,
  );

  private id = '';

  constructor() {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.wavesService.getById(this.id).subscribe({
      next: (wave) => {
        if (!wave) {
          this.state.set('error');
          return;
        }
        this.wave.set(wave);
        this.wavesService.getOrders(this.id).subscribe((orders) => this.orders.set(orders));
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  back(): void {
    this.router.navigate(['/wms/waves']);
  }

  releaseWave(): void {
    if (!this.wave() || this.wave()!.status !== 'planned') return;
    this.releasing.set(true);
    this.wavesService.release(this.id).subscribe({
      next: (wave) => {
        this.releasing.set(false);
        if (wave) this.wave.set(wave);
      },
      error: () => this.releasing.set(false),
    });
  }

  orderTone(status: WaveOrderRow['status']): string {
    const tone: Record<WaveOrderRow['status'], string> = {
      ok: 'tone-success',
      'capacity-risk': 'tone-warning',
      'stock-shortage': 'tone-danger',
    };
    return tone[status];
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
}
