import { type ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { provideLoopbackApi } from '@fitoverforty/blog-angular-data-access';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Prefixes loopback onto relative API URLs. It replaces `HttpBackend`
    // rather than adding an interceptor so that it runs *after* the transfer
    // cache, which would otherwise key the server's requests by an absolute
    // URL and the browser's by a relative one and never hit — see #80 and the
    // comment on `LoopbackApiBackend`.
    provideLoopbackApi(),
  ],
};

export const serverAppConfig = mergeApplicationConfig(appConfig, serverConfig);
