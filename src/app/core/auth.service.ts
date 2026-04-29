import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

/** Shape of the bearer token response returned by the backend. */
export interface TokenResponse {
  accessToken: string;
  expiresInSeconds: number;
}

/** Key under which the token is persisted in browser storage. */
const TOKEN_KEY = 'aio.token';

/**
 * Singleton authentication service used by guards, interceptors, and
 * page components.
 *
 * The current token is exposed as a readable signal so consumers can
 * react to login and logout transitions without subscribing to an
 * observable. The token is mirrored to browser storage so a page
 * refresh keeps the user signed in until the token actually expires
 * or is cleared explicitly.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  // Initialised from browser storage so refreshes preserve the session.
  private tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  /** Readable signal that emits the current bearer token. */
  readonly token = this.tokenSignal.asReadonly();

  /** Convenience signal that reports whether a session is active. */
  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);

  /**
   * Exchanges username and password for a bearer token. The token is
   * persisted on success so the user stays signed in across reloads.
   */
  login(username: string, password: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>('/auth/login', { username, password })
      .pipe(tap(res => this.setToken(res.accessToken)));
  }

  /** Clears the stored token and signals an unauthenticated state. */
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.tokenSignal.set(null);
  }

  /** Persists the supplied token and updates the signal. */
  private setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.tokenSignal.set(token);
  }
}
