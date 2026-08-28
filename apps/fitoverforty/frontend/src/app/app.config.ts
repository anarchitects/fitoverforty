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
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideDesignSystemConfig } from '@anarchitects/common-angular-design/config';
import { provideAnxDefaultLayouts } from '@anarchitects/common-angular-ui-layouts/defaults';
import { appRoutes } from './app.routes';
import {
  apiBaseUrlInterceptor,
  CONTENT_SOURCE,
  HttpContentSource,
} from '@fitoverforty/blog-angular-data-access';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Without this Angular throws away the server-rendered DOM and renders
    // again from scratch, which also means no HTTP transfer cache and every
    // request the server already made being repeated by the browser.
    provideClientHydration(withEventReplay()),
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
