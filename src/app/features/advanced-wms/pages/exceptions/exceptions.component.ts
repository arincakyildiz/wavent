import { Component, computed, inject, signal } from '@angular/core';
import { ExceptionRow, ExceptionsService } from '../../data-access/exceptions.service';

type LoadState = 'loading' | 'success' | 'error';
type StatusFilter = 'all' | ExceptionRow['status'];

@Component({
  selector: 'app-exceptions',
  imports: [],
  templateUrl: './exceptions.component.html',
  styleUrl: './exceptions.component.scss',
})
export class ExceptionsComponent {
  private readonly exceptionsService = inject(ExceptionsService);

  readonly state = signal<LoadState>('loading');
  readonly rows = signal<ExceptionRow[]>([]);
  readonly statusFilter = signal<StatusFilter>('all');
  readonly resolvingId = signal<string | null>(null);
  readonly noteDraft = signal('');

  readonly filtered = computed(() => {
    const f = this.statusFilter();
    return f === 'all' ? this.rows() : this.rows().filter((r) => r.status === f);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.exceptionsService.list().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  startResolve(id: string): void {
    this.resolvingId.set(id);
    this.noteDraft.set('');
  }

  cancelResolve(): void {
    this.resolvingId.set(null);
  }

  confirmResolve(id: string): void {
    const note = this.noteDraft().trim();
    if (!note) return;
    this.exceptionsService.resolve(id, note).subscribe((updated) => {
      if (!updated) return;
      this.rows.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
      this.resolvingId.set(null);
    });
  }

  severityTone(severity: ExceptionRow['severity']): string {
    const tone: Record<ExceptionRow['severity'], string> = {
      low: 'tone-neutral',
      medium: 'tone-warning',
      high: 'tone-danger',
      critical: 'tone-danger',
    };
    return tone[severity];
  }

  statusTone(status: ExceptionRow['status']): string {
    const tone: Record<ExceptionRow['status'], string> = {
      open: 'tone-danger',
      investigating: 'tone-warning',
      resolved: 'tone-success',
    };
    return tone[status];
  }
}
