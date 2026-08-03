import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/**
 * §9 ExceptionWorkbench — the case view for a single exception: the evidence behind
 * it, the reassignment control, and the resolve decision. Presentational; the host
 * screen owns the writes and the confirm/reason dialog.
 */

export interface WorkbenchException {
  id: string;
  type: string;
  severity: string;
  status: string;
  referenceType: string;
  referenceId: string;
  owner?: string;
  createdAt: string;
  resolutionNote?: string;
}

export interface WorkbenchEvidence {
  label: string;
  value: string;
  hint?: string;
}

@Component({
  selector: 'app-exception-workbench',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './exception-workbench.component.html',
  styleUrl: './exception-workbench.component.scss',
})
export class ExceptionWorkbenchComponent {
  readonly exception = input.required<WorkbenchException>();
  readonly evidence = input<WorkbenchEvidence[]>([]);
  readonly owners = input<string[]>([]);
  readonly loading = input(false);
  /** Blocks both actions while a write is in flight. */
  readonly busy = input(false);

  readonly reassign = output<string>();
  readonly resolve = output<void>();

  /** Owner chosen in the dropdown, before it is submitted. */
  readonly selectedOwner = signal('');

  readonly isResolved = computed(() => this.exception().status === 'resolved');

  /** Reassignment only makes sense to somebody who does not already own it. */
  readonly canReassign = computed(() => {
    const owner = this.selectedOwner();
    return !!owner && owner !== this.exception().owner && !this.isResolved() && !this.busy();
  });

  onOwnerChange(value: string): void {
    this.selectedOwner.set(value);
  }

  submitReassign(): void {
    if (!this.canReassign()) return;
    this.reassign.emit(this.selectedOwner());
    this.selectedOwner.set('');
  }

  submitResolve(): void {
    if (this.isResolved() || this.busy()) return;
    this.resolve.emit();
  }

  severityTone(severity: string): string {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'tone-danger';
      case 'medium':
        return 'tone-warning';
      default:
        return 'tone-neutral';
    }
  }

  statusTone(status: string): string {
    switch (status) {
      case 'open':
        return 'tone-danger';
      case 'investigating':
        return 'tone-warning';
      default:
        return 'tone-success';
    }
  }
}
