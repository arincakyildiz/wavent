import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Permission } from './permissions';

/**
 * Route-level authorisation. Attach with `canActivate: [requirePermission('wave.view')]`
 * so an unauthorised role cannot reach the screen — or its lazy bundle — by URL.
 */
export function requirePermission(...permissions: Permission[]): CanActivateFn {
  return (route) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (permissions.some((p) => auth.can(p))) return true;

    // Rendered as a 403 screen rather than a silent redirect, so the denial is visible.
    return router.createUrlTree(['/wms/unauthorized'], {
      queryParams: { from: route.routeConfig?.path ?? '', need: permissions.join(',') },
    });
  };
}
