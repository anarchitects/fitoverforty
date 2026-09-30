import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
  withNoIncrementalHydration,
} from '@angular/platform-browser';
import { provideDesignSystemConfig } from '@anarchitects/common-angular-design/config';
import { provideAnxDefaultLayouts } from '@anarchitects/common-angular-ui-layouts/defaults';
import { FIT_OVER_FORTY } from '@fitoverforty/site-ts';
import { provideSiteIdentity } from '@fitoverforty/site-angular';
import { appRoutes } from './app.routes';
import {
  CONTENT_SOURCE,
  HttpContentSource,
} from '@fitoverforty/blog-angular-data-access';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Without this Angular throws away the server-rendered DOM and renders
    // again from scratch, which also means no HTTP transfer cache and every
    // request the server already made being repeated by the browser.
    provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
    provideRouter(appRoutes, withComponentInputBinding()),
    // Relative API URLs are correct as they stand in the browser. Making
    // them absolute for SSR is `provideLoopbackApi()`'s job, below the
    // interceptor chain, in `app.config.server.ts`.
    provideHttpClient(withFetch()),
    HttpContentSource,
    { provide: CONTENT_SOURCE, useExisting: HttpContentSource },
    // Naming the site is the composition root's job. The libraries that
    // render it — the footer, the home page, the admin screens — read it from
    // here rather than holding a literal, which is what makes them usable by
    // anything else. The token has no default on purpose: a library that
    // falls back to a name works everywhere and is wrong nearly everywhere.
    provideSiteIdentity(FIT_OVER_FORTY),
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
