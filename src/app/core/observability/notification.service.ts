import { Injectable, signal } from '@angular/core';

export type NotificationKind = 'success' | 'error' | 'warning' | 'info';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail?: string;
  /** Optional inline retry, used when an optimistic write was rolled back. */
  retry?: () => void;
  createdAt: Date;
}

const AUTO_DISMISS_MS: Record<NotificationKind, number | null> = {
  success: 3500,
  info: 4000,
  warning: 6000,
  // Errors stay until dismissed — they usually carry a retry action.
  error: null,
};

let counter = 0;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly items = signal<AppNotification[]>([]);

  readonly notifications = this.items.asReadonly();

  push(input: Omit<AppNotification, 'id' | 'createdAt'>): string {
    const id = `n-${++counter}`;
    const notification: AppNotification = { ...input, id, createdAt: new Date() };
    this.items.update((list) => [notification, ...list].slice(0, 6));

    const ttl = AUTO_DISMISS_MS[notification.kind];
    if (ttl !== null) {
      setTimeout(() => this.dismiss(id), ttl);
    }
    return id;
  }

  success(title: string, detail?: string): string {
    return this.push({ kind: 'success', title, detail });
  }

  error(title: string, detail?: string, retry?: () => void): string {
    return this.push({ kind: 'error', title, detail, retry });
  }

  warning(title: string, detail?: string): string {
    return this.push({ kind: 'warning', title, detail });
  }

  info(title: string, detail?: string): string {
    return this.push({ kind: 'info', title, detail });
  }

  dismiss(id: string): void {
    this.items.update((list) => list.filter((n) => n.id !== id));
  }

  clear(): void {
    this.items.set([]);
  }
}
