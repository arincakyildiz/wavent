import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Permission } from '../../../core/auth/permissions';
import { NotificationService } from '../../../core/observability/notification.service';
import { ThemeService } from '../../../core/state/theme.service';
import { ALL_WAREHOUSES, WarehouseScopeService } from '../../../core/state/warehouse-scope.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../icon/icon.component';
import { ToastHostComponent } from '../toast-host/toast-host.component';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  permission: Permission;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    IconComponent,
    ToastHostComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly currentUser = this.auth.currentUser;
  readonly theme = this.themeService.theme;
  readonly collapsed = signal(false);
  readonly searchTerm = signal('');
  readonly scopeMenuOpen = signal(false);
  readonly mobileNavOpen = signal(false);

  readonly warehouses = this.scope.permitted;
  readonly scopeLabel = this.scope.label;
  readonly canChooseScope = this.scope.canChoose;
  readonly selectedScope = this.scope.selected;
  readonly allWarehouses = ALL_WAREHOUSES;

  readonly notificationCount = computed(() => this.notifications.notifications().length);

  private readonly allGroups: NavGroup[] = [
    {
      label: null,
      items: [
        { label: 'Overview', path: '/wms/overview', icon: 'dashboard', permission: 'overview.view' },
        { label: 'Warehouses', path: '/wms/warehouses', icon: 'warehouse', permission: 'warehouse.view' },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { label: 'Inventory', path: '/wms/inventory', icon: 'boxes', permission: 'inventory.view' },
        { label: 'Lot / Serial', path: '/wms/lot-serial', icon: 'barcode', permission: 'lot.view' },
        { label: 'Stock Movements', path: '/wms/stock-movements', icon: 'transfer', permission: 'movement.view' },
        { label: 'Reservations', path: '/wms/reservations', icon: 'bookmark', permission: 'reservation.view' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Receiving', path: '/wms/receiving', icon: 'inbox', permission: 'receiving.view' },
        { label: 'Putaway', path: '/wms/putaway', icon: 'putaway', permission: 'putaway.view' },
        { label: 'Waves', path: '/wms/waves', icon: 'waves', permission: 'wave.view' },
        { label: 'Picking', path: '/wms/picking/tasks', icon: 'target', permission: 'picking.view' },
        { label: 'Packing', path: '/wms/packing', icon: 'package', permission: 'packing.view' },
        { label: 'Shipping', path: '/wms/shipping', icon: 'truck', permission: 'shipping.view' },
      ],
    },
    {
      label: 'Quality',
      items: [
        { label: 'Cycle Counts', path: '/wms/cycle-counts', icon: 'clipboardCheck', permission: 'cycleCount.view' },
        { label: 'Exceptions', path: '/wms/exceptions', icon: 'alertTriangle', permission: 'exception.view' },
      ],
    },
    {
      label: 'Visibility',
      items: [
        { label: 'Traceability', path: '/wms/traceability', icon: 'gitBranch', permission: 'traceability.view' },
        { label: 'Control Tower', path: '/wms/control-tower', icon: 'radio', permission: 'controlTower.view' },
      ],
    },
    {
      label: 'Admin',
      items: [
        { label: 'Audit Log', path: '/wms/audit-log', icon: 'fileText', permission: 'audit.view' },
        { label: 'Settings', path: '/wms/settings', icon: 'settings', permission: 'settings.view' },
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
    if (this.mobileNavOpen()) this.collapsed.set(false);
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
    return this.currentUser()
      .role.split('-')
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' ');
  }

  initials(): string {
    return this.currentUser()
      .name.split(' ')
      .map((part) => part[0])
      .join('');
  }
}
