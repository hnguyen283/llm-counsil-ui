import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

/**
 * Top-level route table.
 *
 * The dashboard sits behind the authentication guard so unauthenticated
 * users are redirected to the login page. Both pages are loaded lazily
 * to keep the initial bundle small. Unknown paths fall through to the
 * dashboard, which in turn defers the redirect decision to the guard.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
