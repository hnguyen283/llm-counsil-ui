import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="wrap">
      <div class="card">
        <h1>LLM Counsil</h1>
        <p class="subtitle">Sign in to run multi-model research jobs</p>

        <form (ngSubmit)="submit()">
          <label>
            <span>Username</span>
            <input type="text" [(ngModel)]="username" name="username" autocomplete="username" required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" [(ngModel)]="password" name="password" autocomplete="current-password" required />
          </label>

          @if (error()) {
            <div class="error">{{ error() }}</div>
          }

          <button class="primary" type="submit" [disabled]="busy()">
            {{ busy() ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>

        <p class="hint">Demo backend accepts any non-empty credentials.</p>
      </div>
    </div>
  `,
  styles: [`
    .wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 400px;
      background: var(--bg-elev);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 32px;
    }
    h1 { margin: 0 0 4px 0; font-size: 22px; }
    .subtitle { margin: 0 0 24px 0; color: var(--text-dim); }
    label { display: block; margin-bottom: 16px; }
    label span { display: block; margin-bottom: 6px; color: var(--text-dim); font-size: 13px; }
    button { width: 100%; padding: 12px; margin-top: 4px; }
    .error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid var(--red);
      color: var(--red);
      padding: 10px 12px;
      border-radius: var(--radius);
      margin-bottom: 16px;
      font-size: 13px;
    }
    .hint {
      margin-top: 20px;
      font-size: 12px;
      color: var(--text-dim);
      text-align: center;
    }
  `]
})
/**
 * Public sign-in page.
 *
 * Collects credentials, exchanges them for a bearer token via the auth
 * service, and routes the user to the dashboard on success. Failures
 * are surfaced inline so the user can correct and retry.
 */
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  /** Tracks whether a login request is currently in flight. */
  busy = signal(false);
  /** Most recent error message to surface to the user, if any. */
  error = signal<string | null>(null);

  /** Submits the credentials and routes to the dashboard on success. */
  submit() {
    if (!this.username || !this.password) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: err => {
        this.busy.set(false);
        this.error.set(err?.error?.message || 'Login failed. Check the gateway is up.');
      }
    });
  }
}
