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

interface RuleToggle {
  key: string;
  label: string;
  description: string;
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

  readonly currentUser = this.auth.currentUser;
  readonly theme = this.themeService.theme;
  readonly faultProfile = this.faults.profile;
  readonly saved = signal(false);

  readonly roles = ROLE_CATALOG;

  readonly rules = signal<RuleToggle[]>([
    { key: 'fefo', label: 'FEFO zorunluluğu', description: 'Daha erken SKT’li uygun lot varken sonraki lot seçilemez; override gerekçesi ister.', enabled: true },
    { key: 'capacity', label: 'Kapasite kontrolü', description: 'Lokasyon kapasitesini aşan putaway işlemi onay ister.', enabled: true },
    { key: 'weight', label: 'Ağırlık toleransı onayı', description: 'Tolerans dışı paket supervisor onayı olmadan devam edemez.', enabled: true },
    { key: 'secondCount', label: 'İkinci sayım zorunluluğu', description: 'Sayım farkı eşiği aşıldığında ikinci sayım açılır.', enabled: true },
    { key: 'audit', label: 'Audit event üretimi', description: 'Her override, yayınlama, onay ve oluşturma audit event üretir.', enabled: true },
    { key: 'optimistic', label: 'Optimistic update', description: 'Putaway kabulü anında yansıtılır; hata halinde geri alınır ve bildirilir.', enabled: true },
  ]);

  readonly varianceThreshold = signal(VARIANCE_THRESHOLD_PCT);

  permissionCount(role: Role): number {
    return ROLE_PERMISSIONS[role].length;
  }

  switchAccount(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
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
    this.flagSaved();
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
      'Sonraki istek başarısız olacak',
      `Bir sonraki servis çağrısı "${kind}" hatasıyla dönecek.`,
    );
  }

  resetFaults(): void {
    this.faults.reset();
    this.notifications.success('Hata simülasyonu sıfırlandı');
  }

  private flagSaved(): void {
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 1800);
  }
}
