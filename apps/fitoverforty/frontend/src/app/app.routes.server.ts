import { RenderMode, type ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Client-rendered on purpose, for two reasons that agree.
    //
    // Spec §8: the form fetches its configuration from the backend at runtime,
    // so there is nothing to server-render and no SEO value in trying.
    //
    // And empirically: @anarchitects/forms-angular is not hydration-safe.
    // Server-rendering it fails serialization with NG0502, because the DOM it
    // builds is not the DOM Angular expects to find when it hydrates.
    path: 'contact',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
