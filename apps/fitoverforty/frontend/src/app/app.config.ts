import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideDesignSystemConfig } from '@anarchitects/common-angular-design/config';
import { provideAnxDefaultLayouts } from '@anarchitects/common-angular-ui-layouts/defaults';
import { appRoutes } from './app.routes';
import { apiBaseUrlInterceptor } from './blog/api-base-url.interceptor';
import { CONTENT_SOURCE } from './blog/content-source.token';
import { HttpContentSource } from './blog/http-content-source';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([apiBaseUrlInterceptor])),
    HttpContentSource,
    { provide: CONTENT_SOURCE, useExisting: HttpContentSource },
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
