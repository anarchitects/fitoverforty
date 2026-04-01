import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideDesignSystemConfig } from '@anarchitects/common-angular-design/config';
import { provideAnxDefaultLayouts } from '@anarchitects/common-angular-ui-layouts/defaults';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
    provideDesignSystemConfig({
      theme: 'fitoverforty',
      density: 'comfortable',
      surface: 'plain',
      layout: 'list',
      columns: 1,
    }),
    provideAnxDefaultLayouts(),
  ],
};
