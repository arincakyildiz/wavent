import { Component, inject } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { NotificationKind, NotificationService } from '../../../core/observability/notification.service';
import { IconComponent } from '../icon/icon.component';

const ICON: Record<NotificationKind, string> = {
  success: 'checkCircle',
  error: 'alertTriangle',
  warning: 'alertTriangle',
  info: 'bell',
};

@Component({
  selector: 'app-notification-panel',
  imports: [IconComponent],
  template: `
    <section id="notification-panel" class="panel" role="dialog" [attr.aria-label]="i18n.t('nav.notifications')">
      <header class="panel__header">
        <strong>{{ i18n.t('nav.notifications') }}</strong>
        @if (notifications().length) {
          <button class="panel__clear" type="button" (click)="clear()">
            {{ i18n.t('notifications.clearAll') }}
          </button>
        }
      </header>

      <div class="panel__body">
        @for (notification of notifications(); track notification.id) {
          <article class="item" [class]="'item--' + notification.kind">
            <span class="item__icon">
              <app-icon [name]="icon(notification.kind)" [size]="15" />
            </span>
            <div class="item__content">
              <strong>{{ notification.title }}</strong>
              @if (notification.detail) {
                <span>{{ notification.detail }}</span>
              }
              @if (notification.retry) {
                <button type="button" (click)="retry(notification.id, notification.retry!)">
                  {{ i18n.t('common.retry') }}
                </button>
              }
            </div>
            <button
              class="item__dismiss icon-btn"
              type="button"
              (click)="dismiss(notification.id)"
              [attr.aria-label]="i18n.t('notifications.dismiss')"
            >
              <app-icon name="x" [size]="14" />
            </button>
          </article>
        } @empty {
          <div class="panel__empty">
            <app-icon name="bell" [size]="20" />
            <span>{{ i18n.t('notifications.empty') }}</span>
          </div>
        }
      </div>
    </section>
  `,
  styleUrl: './notification-panel.component.scss',
})
export class NotificationPanelComponent {
  readonly i18n = inject(I18nService);
  private readonly service = inject(NotificationService);

  readonly notifications = this.service.history;

  icon(kind: NotificationKind): string {
    return ICON[kind];
  }

  dismiss(id: string): void {
    this.service.dismiss(id);
  }

  clear(): void {
    this.service.clear();
  }

  retry(id: string, action: () => void): void {
    this.service.dismiss(id);
    action();
  }
}
