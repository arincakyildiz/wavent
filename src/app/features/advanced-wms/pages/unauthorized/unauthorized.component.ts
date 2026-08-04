import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { I18nService } from '../../../../core/i18n/i18n.service';

@Component({
  selector: 'app-unauthorized',
  imports: [IconComponent],
  templateUrl: './unauthorized.component.html',
  styleUrl: './unauthorized.component.scss',
})
export class UnauthorizedComponent {
  readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly currentUser = this.auth.currentUser;
  readonly from = this.route.snapshot.queryParamMap.get('from') ?? '';
  readonly needed = (this.route.snapshot.queryParamMap.get('need') ?? '').split(',').filter(Boolean);

  roleLabel(): string {
    return this.currentUser()
      .role.split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ');
  }

  goOverview(): void {
    this.router.navigate(['/wms/overview']);
  }

  goSettings(): void {
    this.router.navigate(['/wms/settings']);
  }
}
