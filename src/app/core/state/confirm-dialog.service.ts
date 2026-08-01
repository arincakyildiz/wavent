import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  /** When true the operator must type a justification before confirming. */
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
}

export interface ConfirmResult {
  confirmed: boolean;
  reason?: string;
}

interface OpenDialog extends ConfirmRequest {
  id: number;
}

let counter = 0;

/**
 * Single dialog host driven by a signal. Critical operations subscribe to `ask()`
 * and only proceed on `confirmed: true`, which is how the "no destructive action
 * without confirmation (and a reason where required)" rule is enforced.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly current = signal<OpenDialog | null>(null);
  private pending: Subject<ConfirmResult> | null = null;

  readonly dialog = this.current.asReadonly();

  ask(request: ConfirmRequest): Observable<ConfirmResult> {
    // A second request replaces the first; the abandoned caller gets a cancel.
    this.settle({ confirmed: false });

    const subject = new Subject<ConfirmResult>();
    this.pending = subject;
    this.current.set({ ...request, id: ++counter });
    return subject.asObservable();
  }

  resolve(result: ConfirmResult): void {
    this.current.set(null);
    this.settle(result);
  }

  private settle(result: ConfirmResult): void {
    if (!this.pending) return;
    const subject = this.pending;
    this.pending = null;
    subject.next(result);
    subject.complete();
  }
}
