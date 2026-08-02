import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Gates the whole shell behind login. An unauthenticated visitor is bounced to
 * /login with a returnUrl so they land back where they were headed after signing in.
 */
export const requireAuth: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
