import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface TokenResponse {
  accessToken: string;
  expiresInSeconds: number;
}

const TOKEN_KEY = 'aio.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  // Signal holds the current token. Starts from localStorage so refresh keeps us logged in.
  private tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly token = this.tokenSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);

  login(username: string, password: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>('/auth/login', { username, password })
      .pipe(tap(res => this.setToken(res.accessToken)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.tokenSignal.set(null);
  }

  private setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.tokenSignal.set(token);
  }
}
