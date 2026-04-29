import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * HTTP interceptor that attaches the bearer token to outbound requests
 * and reacts to authentication failures.
 *
 * The login endpoint is excluded so the credential exchange itself is
 * never sent with a stale token. Any response that comes back with an
 * unauthorized status clears the local session and routes the user to
 * the login page so the next request is made with fresh credentials.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // The login request must not carry a stale token; everything else does.
  const token = auth.token();
  const authedReq = token && !req.url.includes('/auth/login')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        auth.logout();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
