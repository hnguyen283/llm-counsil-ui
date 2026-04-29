import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

/**
 * Application-wide provider configuration.
 *
 * Wires the router with the declared route table, configures the HTTP
 * client to run the authentication interceptor on every outbound call,
 * and enables event coalescing for change detection so user input does
 * not cause redundant tick passes.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
