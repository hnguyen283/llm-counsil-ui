import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

/**
 * Application entry point.
 *
 * Bootstraps the root component with the shared provider configuration
 * and reports any startup failure to the browser console so it surfaces
 * during development.
 *
 * @author Nguyen Dong Hung
 */
bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
