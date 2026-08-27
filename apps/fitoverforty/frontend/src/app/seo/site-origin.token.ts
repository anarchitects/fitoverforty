import { DOCUMENT, inject, InjectionToken, REQUEST } from '@angular/core';

/**
 * The site's public origin, for canonical and OpenGraph URLs.
 *
 * `SITE_URL` wins everywhere, because behind a proxy the request's own host is
 * the internal one and every canonical URL would point somewhere unreachable.
 * Otherwise: the incoming request on the server, the current page in the
 * browser.
 */
export const SITE_ORIGIN = new InjectionToken<string>('SITE_ORIGIN', {
  providedIn: 'root',
  factory: () => {
    const configured = (
      globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env?.['SITE_URL'];
    if (configured) return configured.replace(/\/+$/, '');

    const request = inject(REQUEST, { optional: true });
    if (request) return new URL(request.url).origin;

    return inject(DOCUMENT).location.origin;
  },
});
