import { Component, inject } from '@angular/core';
import { NotificationKind, NotificationService } from '../../../core/observability/notification.service';
import { IconComponent } from '../icon/icon.component';

const ICON: Record<NotificationKind, string> = {
  success: 'checkCircle',
  error: 'alertTriangle',
  warning: 'alertTriangle',
  info: 'bell',
};

@Component({
  selector: 'app-toast-host',
  imports: [IconComponent],
  template: `
    <!-- aria-live so screen readers announce optimistic rollbacks and failures -->
    <div class="toasts" role="region" aria-live="polite" aria-label="Bildirimler">
      @for (n of notifications(); track n.id) {
        <div class="toast" [class]="'toast--' + n.kind">
          <span class="toast__icon">
            <app-icon [name]="icon(n.kind)" [size]="16" />
          </span>
          <div class="toast__body">
            <div class="toast__title">{{ n.title }}</div>
            @if (n.detail) {
              <div class="toast__detail">{{ n.detail }}</div>
            }
            @if (n.retry) {
              <button class="toast__retry" type="button" (click)="retry(n.id, n.retry!)">Tekrar dene</button>
            }
          </div>
          <button class="toast__close" type="button" (click)="dismiss(n.id)" aria-label="Bildirimi kapat">×</button>
        </div>
      }
    </div>
  `,
  styleUrl: './toast-host.component.scss',
})
export class ToastHostComponent {
  private readonly notificationService = inject(NotificationService);

  readonly notifications = this.notificationService.notifications;

  icon(kind: NotificationKind): string {
    return ICON[kind];
  }

  dismiss(id: string): void {
    this.notificationService.dismiss(id);
  }

  retry(id: string, action: () => void): void {
    this.notificationService.dismiss(id);
    action();
  }
}
