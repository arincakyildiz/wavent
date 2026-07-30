import { Component, computed, inject, signal } from '@angular/core';
import { PickingService, PickTaskRow } from '../../data-access/picking.service';

type LoadState = 'loading' | 'success' | 'error';
type StatusFilter = 'all' | PickTaskRow['status'];

@Component({
  selector: 'app-picking-tasks',
  imports: [],
  templateUrl: './picking-tasks.component.html',
  styleUrl: './picking-tasks.component.scss',
})
export class PickingTasksComponent {
  private readonly pickingService = inject(PickingService);

  readonly state = signal<LoadState>('loading');
  readonly tasks = signal<PickTaskRow[]>([]);
  readonly statusFilter = signal<StatusFilter>('all');

  readonly filtered = computed(() => {
    const f = this.statusFilter();
    return f === 'all' ? this.tasks() : this.tasks().filter((t) => t.status === f);
  });

  readonly exceptionCount = computed(() => this.tasks().filter((t) => t.status === 'exception').length);

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.pickingService.list().subscribe({
      next: (rows) => {
        this.tasks.set(rows);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  statusTone(status: PickTaskRow['status']): string {
    const tone: Record<PickTaskRow['status'], string> = {
      pending: 'tone-neutral',
      'in-progress': 'tone-info',
      exception: 'tone-danger',
      completed: 'tone-success',
    };
    return tone[status];
  }

  progressPct(task: PickTaskRow): number {
    return task.lineCount ? Math.round((task.pickedLines / task.lineCount) * 100) : 0;
  }
}
