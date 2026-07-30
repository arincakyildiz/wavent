import { Component, inject, signal } from '@angular/core';
import { cycleVariance, CycleCountRow, CycleCountsService } from '../../data-access/cycle-counts.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-cycle-counts',
  imports: [],
  templateUrl: './cycle-counts.component.html',
  styleUrl: './cycle-counts.component.scss',
})
export class CycleCountsComponent {
  private readonly cycleCountsService = inject(CycleCountsService);

  readonly state = signal<LoadState>('loading');
  readonly rows = signal<CycleCountRow[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.cycleCountsService.list().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  variance(row: CycleCountRow): number {
    return cycleVariance(row);
  }

  statusTone(status: CycleCountRow['status']): string {
    const tone: Record<CycleCountRow['status'], string> = {
      scheduled: 'tone-neutral',
      'in-progress': 'tone-info',
      'variance-review': 'tone-warning',
      closed: 'tone-success',
    };
    return tone[status];
  }
}
