import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/state/theme.service';
import { IconComponent } from '../icon/icon.component';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  exact?: boolean;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  readonly currentUser = this.auth.currentUser;
  readonly theme = this.themeService.theme;
  readonly collapsed = signal(false);

  readonly navGroups: NavGroup[] = [
    {
      label: null,
      items: [
        { label: 'Overview', path: '/wms/overview', icon: 'dashboard' },
        { label: 'Warehouses', path: '/wms/warehouses', icon: 'warehouse' },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { label: 'Inventory', path: '/wms/inventory', icon: 'boxes' },
        { label: 'Lot / Serial', path: '/wms/lot-serial', icon: 'barcode' },
        { label: 'Stock Movements', path: '/wms/stock-movements', icon: 'transfer' },
        { label: 'Reservations', path: '/wms/reservations', icon: 'bookmark' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Receiving', path: '/wms/receiving', icon: 'inbox' },
        { label: 'Putaway', path: '/wms/putaway', icon: 'putaway' },
        { label: 'Waves', path: '/wms/waves', icon: 'waves' },
        { label: 'Picking', path: '/wms/picking/tasks', icon: 'target' },
        { label: 'Packing', path: '/wms/packing', icon: 'package' },
        { label: 'Shipping', path: '/wms/shipping', icon: 'truck' },
      ],
    },
    {
      label: 'Quality',
      items: [
        { label: 'Cycle Counts', path: '/wms/cycle-counts', icon: 'clipboardCheck' },
        { label: 'Exceptions', path: '/wms/exceptions', icon: 'alertTriangle' },
      ],
    },
    {
      label: 'Visibility',
      items: [
        { label: 'Traceability', path: '/wms/traceability', icon: 'gitBranch' },
        { label: 'Control Tower', path: '/wms/control-tower', icon: 'radio' },
      ],
    },
    {
      label: 'Admin',
      items: [
        { label: 'Audit Log', path: '/wms/audit-log', icon: 'fileText' },
        { label: 'Settings', path: '/wms/settings', icon: 'settings' },
      ],
    },
  ];

  toggleSidebar(): void {
    this.collapsed.update((v) => !v);
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.themeService.set(theme);
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
