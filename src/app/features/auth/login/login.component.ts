import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, Role } from '../../../core/auth/auth.service';
import { ROLE_CATALOG, ROLE_PERMISSIONS } from '../../../core/auth/permissions';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { I18nService } from '../../../core/i18n/i18n.service';

const ROLE_ICONS: Record<Role, string> = {
  'warehouse-operator': 'scanLine',
  'shift-lead': 'target',
  'inventory-controller': 'boxes',
  'shipping-specialist': 'truck',
  planner: 'waves',
  'warehouse-manager': 'settings',
};

@Component({
  selector: 'app-login',
  imports: [IconComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly roles = ROLE_CATALOG;

  roleIcon(role: Role): string {
    return ROLE_ICONS[role];
  }

  permissionCount(role: Role): number {
    return ROLE_PERMISSIONS[role].length;
  }

  /** One click both signs in and enters the app as that role's demo persona. */
  loginAs(role: Role): void {
    this.auth.login(role);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.router.navigateByUrl(returnUrl ?? '/wms/overview');
  }
}
