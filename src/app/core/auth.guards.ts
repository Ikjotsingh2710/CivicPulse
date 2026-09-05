import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { AuthService } from './auth.service';

/** Requires any signed-in citizen. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady();
  if (auth.isAuthenticated()) return true;

  return router.createUrlTree(['/auth'], { queryParams: { redirect: state.url } });
};

/**
 * Requires a row in `admin_users`. The lookup is a real query against an
 * RLS-protected table, so authenticating as a citizen is never enough to reach
 * `/admin` — and even if the route were forced, every admin write is refused by
 * the `admin_all_tickets` policy.
 */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady();
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth'], { queryParams: { redirect: state.url } });
  }

  const row = await auth.refreshAdminRow();
  return row ? true : router.createUrlTree(['/profile']);
};
