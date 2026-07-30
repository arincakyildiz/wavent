import { Component, inject, signal } from '@angular/core';
import { AuthService, Role } from '../../../../core/auth/auth.service';
import { ThemeService } from '../../../../core/state/theme.service';

interface RoleOption {
  value: Role;
  label: string;
  description: string;
}

interface RuleToggle {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

@Component({
  selector: 'app-settings',
  imports: [],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  readonly currentUser = this.auth.currentUser;
  readonly theme = this.themeService.theme;
  readonly saved = signal(false);

  readonly roles: RoleOption[] = [
    { value: 'warehouse-operator', label: 'Depo Operatörü', description: 'Kabul, putaway, toplama, paketleme, sayım ve barkod işlemleri' },
    { value: 'shift-lead', label: 'Vardiya Lideri', description: 'Görev atama, dalga planı, kapasite ve istisna kararları' },
    { value: 'inventory-controller', label: 'Stok Kontrol Uzmanı', description: 'Lot/seri, sayım farkı, karantina ve düzeltme süreçleri' },
    { value: 'shipping-specialist', label: 'Sevkiyat Uzmanı', description: 'Paket, taşıyıcı, yükleme ve sevkiyat kapanışı' },
    { value: 'planner', label: 'Planlama Uzmanı', description: 'Sipariş önceliği, dalga kuralı ve kapasite senaryoları' },
    { value: 'warehouse-manager', label: 'Depo Yöneticisi', description: 'Depo, lokasyon, kural, rol ve KPI ayarları' },
  ];

  readonly rules = signal<RuleToggle[]>([
    { key: 'fefo', label: 'FEFO zorunluluğu', description: 'Daha erken SKT’li uygun lot varken sonraki lot seçilemez; override gerekçesi ister.', enabled: true },
    { key: 'capacity', label: 'Kapasite kontrolü', description: 'Lokasyon kapasitesini aşan putaway işlemi engellenir.', enabled: true },
    { key: 'weight', label: 'Ağırlık toleransı onayı', description: 'Tolerans dışı paket supervisor onayı olmadan devam edemez.', enabled: true },
    { key: 'secondCount', label: 'İkinci sayım zorunluluğu', description: 'Sayım farkı eşiği aşıldığında ikinci sayım açılır.', enabled: true },
    { key: 'audit', label: 'Audit event üretimi', description: 'Her stok düzeltme, override, dalga ve sevkiyat kararı audit event üretir.', enabled: true },
    { key: 'optimistic', label: 'Optimistic update', description: 'İşlemler anında yansıtılır; hata halinde rollback ve bildirim yapılır.', enabled: false },
  ]);

  readonly varianceThreshold = signal(2);
  readonly weightTolerance = signal(0.3);

  setRole(role: string): void {
    this.auth.setRole(role as Role);
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

  updateTolerance(value: string): void {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      this.weightTolerance.set(parsed);
      this.flagSaved();
    }
  }

  private flagSaved(): void {
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 1800);
  }
}
