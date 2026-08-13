import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FaultInjectionService } from '../../../../core/api/fault-injection.service';
import { ApiErrorKind } from '../../../../core/api/api-error';
import { AuthService, Role } from '../../../../core/auth/auth.service';
import { ROLE_CATALOG, ROLE_PERMISSIONS } from '../../../../core/auth/permissions';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { ThemeService } from '../../../../core/state/theme.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { VARIANCE_THRESHOLD_PCT } from '../../data-access/selectors';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { DemoDataService } from '../../data-access/demo-data.service';

interface RuleToggle {
  /** Catalog key stem — label and description come from `rule.<key>` / `rule.<key>.desc`. */
  key: string;
  enabled: boolean;
}

@Component({
  selector: 'app-settings',
  imports: [HasPermissionDirective],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly faults = inject(FaultInjectionService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmDialogService);
  readonly demoData = inject(DemoDataService);

  readonly currentUser = this.auth.currentUser;
  readonly theme = this.themeService.theme;
  readonly faultProfile = this.faults.profile;
  readonly saved = signal(false);

  readonly roles = ROLE_CATALOG;

  readonly rules = signal<RuleToggle[]>([
    { key: 'fefo', enabled: true },
    { key: 'capacity', enabled: true },
    { key: 'weight', enabled: true },
    { key: 'secondCount', enabled: true },
    { key: 'audit', enabled: true },
    { key: 'optimistic', enabled: true },
  ]);

  readonly varianceThreshold = signal(VARIANCE_THRESHOLD_PCT);

  permissionCount(role: Role): number {
    return ROLE_PERMISSIONS[role].length;
  }

  switchAccount(): void {
    this.auth.logout();
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/wms/overview' } });
  }

  setRole(role: string): void {
    const previous = this.currentUser().role;
    this.auth.setRole(role as Role);
    this.audit.record({
      actionType: 'Role Switched',
      targetType: 'User',
      targetId: this.currentUser().name,
      oldValue: previous,
      newValue: role,
    });
    this.notifications.success(
      this.i18n.t('settings.roleChanged'),
      this.i18n.t('settings.roleChangedBody', { role: this.i18n.t(`role.${role}`) }),
    );
    this.router.navigateByUrl('/wms/overview');
  }

  setTheme(theme: string): void {
    this.themeService.set(theme as 'dark' | 'light');
    this.flagSaved();
  }

  toggleRule(key: string): void {
    this.rules.update((list) => list.map((r) => (r.key === key ? { ...r, enabled: !r.enabled } : r)));
    this.flagSaved();
  }

  updateVariance(value: string): void {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      this.varianceThreshold.set(parsed);
      this.flagSaved();
    }
  }

  /* ---------- Fault injection ---------- */

  setReadFailRate(value: string): void {
    this.faults.patch({ readFailRate: Number(value) / 100 });
  }

  setWriteFailRate(value: string): void {
    this.faults.patch({ writeFailRate: Number(value) / 100 });
  }

  setLatency(value: string): void {
    this.faults.patch({ extraLatencyMs: Number(value) });
  }

  /** Arms a one-shot failure so the next request demonstrates that error path. */
  armFailure(kind: ApiErrorKind): void {
    this.faults.armNextFailure(kind);
    this.notifications.info(
      this.i18n.t('settings.armedTitle'),
      this.i18n.t('settings.armedBody', { kind }),
    );
  }

  resetFaults(): void {
    this.faults.reset();
    this.notifications.success(this.i18n.t('settings.faultsReset'));
  }

  loadSampleData(): void {
    this.demoData.loadSampleData();
    this.audit.record({
      actionType: 'Sample Data Loaded',
      targetType: 'System',
      targetId: 'WMS Demo Dataset',
      newValue: this.demoData.recordCount(),
    });
    this.notifications.success(
      this.i18n.t('demoData.loadedTitle'),
      this.i18n.t('demoData.loadedBody'),
    );
    this.router.navigateByUrl('/wms/overview');
  }

  clearAllData(): void {
    this.confirm
      .ask({
        title: this.i18n.t('demoData.clearTitle'),
        message: this.i18n.t('demoData.clearConfirm'),
        confirmLabel: this.i18n.t('demoData.clear'),
        tone: 'danger',
      })
      .subscribe(({ confirmed }) => {
        if (!confirmed) return;
        this.demoData.clearAllData();
        this.audit.clear();
        this.notifications.success(this.i18n.t('demoData.clearedTitle'));
        this.router.navigateByUrl('/wms/overview');
      });
  }

  private flagSaved(): void {
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 1800);
  }
}
