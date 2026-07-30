import { Component, computed, inject, signal } from '@angular/core';
import { AuditEventRow, AuditLogService } from '../../data-access/audit-log.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-audit-log',
  imports: [],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss',
})
export class AuditLogComponent {
  private readonly auditLogService = inject(AuditLogService);

  readonly state = signal<LoadState>('loading');
  readonly rows = signal<AuditEventRow[]>([]);
  readonly search = signal('');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter(
      (r) =>
        r.actor.toLowerCase().includes(term) ||
        r.actionType.toLowerCase().includes(term) ||
        r.targetId.toLowerCase().includes(term),
    );
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.auditLogService.list().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }
}
