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
    /**
     * Client-rendered, and this one is not a workaround.
     *
     * Every admin screen is behind a session, so there is nothing a server
     * render could produce that is both useful and safe: it would either
     * render the signed-out state for everyone, or start rendering
     * account-specific HTML on a path that robots.txt already disallows and
     * that no crawler should ever hold. Rendering it client-side also keeps
     * the session read in one place — the browser, where the cookie is.
     */
    path: 'admin/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
