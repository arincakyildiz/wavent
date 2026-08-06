import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Permission } from '../../../core/auth/permissions';
import { I18nService } from '../../../core/i18n/i18n.service';
import { NotificationService } from '../../../core/observability/notification.service';
import { ThemeService } from '../../../core/state/theme.service';
import { ALL_WAREHOUSES, WarehouseScopeService } from '../../../core/state/warehouse-scope.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../icon/icon.component';
import { LogoMarkComponent } from '../logo-mark/logo-mark.component';
import { ToastHostComponent } from '../toast-host/toast-host.component';

interface NavItem {
  /** Translation key; resolved in the template so it follows the active locale. */
  labelKey: string;
  path: string;
  icon: string;
  permission: Permission;
}

interface NavGroup {
  labelKey: string | null;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    IconComponent,
    LogoMarkComponent,
    ToastHostComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  @ViewChild('sidebarEl') private sidebarEl?: ElementRef<HTMLElement>;
  @ViewChild('navEl') private navEl?: ElementRef<HTMLElement>;

  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  /** Public: the template reads translations straight off it. */
  readonly i18n = inject(I18nService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly currentUser = this.auth.currentUser;
  readonly theme = this.themeService.theme;
  readonly collapsed = signal(false);
  readonly searchTerm = signal('');
  readonly scopeMenuOpen = signal(false);
  readonly mobileNavOpen = signal(false);
  readonly userMenuOpen = signal(false);

  readonly warehouses = this.scope.permitted;
  readonly scopeLabel = this.scope.label;
  readonly canChooseScope = this.scope.canChoose;
  readonly selectedScope = this.scope.selected;
  readonly allWarehouses = ALL_WAREHOUSES;

  readonly notificationCount = computed(() => this.notifications.notifications().length);

  private readonly allGroups: NavGroup[] = [
    {
      labelKey: null,
      items: [
        { labelKey: 'nav.overview', path: '/wms/overview', icon: 'dashboard', permission: 'overview.view' },
        { labelKey: 'nav.warehouses', path: '/wms/warehouses', icon: 'warehouse', permission: 'warehouse.view' },
        { labelKey: 'nav.locations', path: '/wms/locations', icon: 'gitBranch', permission: 'warehouse.view' },
      ],
    },
    {
      labelKey: 'nav.group.inventory',
      items: [
        { labelKey: 'nav.inventory', path: '/wms/inventory', icon: 'boxes', permission: 'inventory.view' },
        { labelKey: 'nav.lotSerial', path: '/wms/lot-serial', icon: 'barcode', permission: 'lot.view' },
        { labelKey: 'nav.stockMovements', path: '/wms/stock-movements', icon: 'transfer', permission: 'movement.view' },
        { labelKey: 'nav.reservations', path: '/wms/reservations', icon: 'bookmark', permission: 'reservation.view' },
      ],
    },
    {
      labelKey: 'nav.group.operations',
      items: [
        { labelKey: 'nav.receiving', path: '/wms/receiving', icon: 'inbox', permission: 'receiving.view' },
        { labelKey: 'nav.putaway', path: '/wms/putaway', icon: 'putaway', permission: 'putaway.view' },
        { labelKey: 'nav.waves', path: '/wms/waves', icon: 'waves', permission: 'wave.view' },
        { labelKey: 'nav.picking', path: '/wms/picking/tasks', icon: 'target', permission: 'picking.view' },
        { labelKey: 'nav.packing', path: '/wms/packing', icon: 'package', permission: 'packing.view' },
        { labelKey: 'nav.shipping', path: '/wms/shipping', icon: 'truck', permission: 'shipping.view' },
      ],
    },
    {
      labelKey: 'nav.group.quality',
      items: [
        { labelKey: 'nav.cycleCounts', path: '/wms/cycle-counts', icon: 'clipboardCheck', permission: 'cycleCount.view' },
        { labelKey: 'nav.exceptions', path: '/wms/exceptions', icon: 'alertTriangle', permission: 'exception.view' },
      ],
    },
    {
      labelKey: 'nav.group.visibility',
      items: [
        { labelKey: 'nav.traceability', path: '/wms/traceability', icon: 'gitBranch', permission: 'traceability.view' },
        { labelKey: 'nav.controlTower', path: '/wms/control-tower', icon: 'radio', permission: 'controlTower.view' },
      ],
    },
    {
      labelKey: 'nav.group.admin',
      items: [
        { labelKey: 'nav.auditLog', path: '/wms/audit-log', icon: 'fileText', permission: 'audit.view' },
        { labelKey: 'nav.settings', path: '/wms/settings', icon: 'settings', permission: 'settings.view' },
      ],
    },
  ];

  /** Navigation mirrors the guards: a screen the role cannot open is not listed. */
  readonly navGroups = computed<NavGroup[]>(() =>
    this.allGroups
      .map((group) => ({ ...group, items: group.items.filter((i) => this.auth.can(i.permission)) }))
      .filter((group) => group.items.length > 0),
  );

  toggleSidebar(): void {
    this.collapsed.update((v) => !v);
  }

  toggleMobileNav(): void {
    this.mobileNavOpen.update((v) => !v);
    if (this.mobileNavOpen()) {
      this.collapsed.set(false);
      // The nav list keeps its scroll position from the last time it auto-scrolled
      // an active link into view (e.g. Audit Log near the bottom); without this the
      // drawer can open with the whole list scrolled out of the visible area.
      if (this.sidebarEl) this.sidebarEl.nativeElement.scrollTop = 0;
      if (this.navEl) this.navEl.nativeElement.scrollTop = 0;
    }
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.themeService.set(theme);
  }

  toggleScopeMenu(): void {
    if (this.canChooseScope()) this.scopeMenuOpen.update((v) => !v);
  }

  selectScope(code: string): void {
    this.scope.select(code);
    this.scopeMenuOpen.set(false);
  }

  /** Global search routes to Inventory with the term pre-applied. */
  submitSearch(event: Event): void {
    event.preventDefault();
    const term = this.searchTerm().trim();
    if (!term) return;
    this.router.navigate(['/wms/inventory'], { queryParams: { q: term, page: 1 } });
  }

  roleLabel(): string {
    return this.i18n.t(`role.${this.currentUser().role}`);
  }

  setLocale(code: string): void {
    this.i18n.set(code === 'en' ? 'en' : 'tr');
  }

  initials(): string {
    return this.currentUser()
      .name.split(' ')
      .map((part) => part[0])
      .join('');
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  logout(): void {
    this.userMenuOpen.set(false);
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
