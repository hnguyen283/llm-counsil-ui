import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, catchError, map } from 'rxjs';

/** Shape of the bearer token response returned by /auth/login and /auth/refresh. */
export interface TokenResponse {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

/**
 * Singleton authentication service used by guards, interceptors, and
 * page components.
 *
 * Storage model (replaces the legacy localStorage approach):
 *  - The **access token** is held in JavaScript memory only. A page reload
 *    drops it; {@link refresh} recovers it silently from the HttpOnly
 *    refresh-token cookie set by the server.
 *  - The **refresh token** is in an HttpOnly + Secure + SameSite=Strict
 *    cookie scoped to /auth, written by the server on /auth/login. The
 *    SPA never sees it.
 *
 * Compared to the previous implementation:
 *  - removed `localStorage.getItem('aio.token')` — keeping the access JWT
 *    in storage was the main XSS exfiltration target.
 *  - added `signup()` and `refresh()` flows wired to the new endpoints.
 *  - added `userId` derived from the JWT `sub` claim for components that
 *    need to render or scope by the current user without re-fetching.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private accessToken = signal<string | null>(null);
  private userId      = signal<string | null>(null);

  readonly token           = this.accessToken.asReadonly();
  readonly isAuthenticated = computed(() => this.accessToken() !== null);

  login(username: string, password: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>('/auth/login', { username, password }, { withCredentials: true })
      .pipe(tap(r => this.adoptAccess(r.accessToken)));
  }

  signup(username: string, email: string, password: string): Observable<void> {
    return this.http.post<void>(
      '/auth/signup',
      { username, email, password },
      { withCredentials: true }
    );
  }

  /**
   * Called on app boot and on 401/AUTH_001. Returns true when the silent
   * refresh succeeds; false when no refresh cookie is present, the cookie
   * has expired, or the family was revoked. On failure the local state is
   * cleared so the caller can route to /login.
   */
  refresh(): Observable<boolean> {
    return this.http
      .post<TokenResponse>('/auth/refresh', {}, { withCredentials: true })
      .pipe(
        tap(r => this.adoptAccess(r.accessToken)),
        map(() => true),
        catchError(() => { this.clear(); return of(false); })
      );
  }

  logout(): Observable<void> {
    return this.http
      .post<void>('/auth/logout', { userId: this.userId() }, { withCredentials: true })
      .pipe(tap(() => this.clear()));
  }

  /** Synchronous accessor for the current user-id (decoded from the JWT `sub`). */
  currentUserId(): string | null { return this.userId(); }

  // ---------- internals ----------

  private adoptAccess(jwt: string): void {
    this.accessToken.set(jwt);
    this.userId.set(this.decodeSub(jwt));
  }

  private clear(): void {
    this.accessToken.set(null);
    this.userId.set(null);
  }

  /**
   * Naive client-side JWT payload decode. The token has already been
   * validated server-side; we just need the `sub` claim. Returns null on
   * any malformed input rather than throwing.
   */
  private decodeSub(jwt: string): string | null {
    try {
      const payload = jwt.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json).sub ?? null;
    } catch {
      return null;
    }
  }
}
