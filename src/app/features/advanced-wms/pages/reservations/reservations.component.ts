import { Component, computed, inject, signal } from '@angular/core';
import { ReservationRow, ReservationsService } from '../../data-access/reservations.service';

type LoadState = 'loading' | 'success' | 'error';
type Filter = 'all' | 'partial' | 'backorder' | 'override';

@Component({
  selector: 'app-reservations',
  imports: [],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.scss',
})
export class ReservationsComponent {
  private readonly reservationsService = inject(ReservationsService);

  readonly state = signal<LoadState>('loading');
  readonly rows = signal<ReservationRow[]>([]);
  readonly filter = signal<Filter>('all');

  readonly filtered = computed(() => {
    const f = this.filter();
    return this.rows().filter((r) => {
      if (f === 'partial') return r.isPartial;
      if (f === 'backorder') return r.isBackorder;
      if (f === 'override') return !!r.overrideReason;
      return true;
    });
  });

  readonly backorderCount = computed(() => this.rows().filter((r) => r.isBackorder).length);
  readonly partialCount = computed(() => this.rows().filter((r) => r.isPartial).length);

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.reservationsService.list().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }
}
