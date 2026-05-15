import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Route guard that requires an authenticated session.
 *
 * The access token now lives in memory only, so a hard page reload always
 * starts unauthenticated. To preserve "stay-signed-in" behaviour, the guard
 * first asks {@link AuthService.refresh} to recover a token from the
 * HttpOnly refresh-token cookie before deciding. Only when no cookie is
 * present (or the family has been revoked) does the user get bounced.
 */
export const authGuard: CanActivateFn = async () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;
  const ok = await firstValueFrom(auth.refresh());
  if (ok) return true;
  router.navigate(['/login']);
  return false;
};
