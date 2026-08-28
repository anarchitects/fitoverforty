import { inject, REQUEST } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * Makes relative API URLs work during server-side rendering.
 *
 * In the browser a request to `/api/blog/posts` resolves against the current
 * page. On the server there is no page, so the same URL has nothing to resolve
 * against and the request fails. Angular exposes the incoming request through
 * the REQUEST token, and its origin is the right base: under the split
 * topology the same Nest process serves both the rendered page and the API.
 *
 * `API_ORIGIN` overrides that for deployments where the renderer and the API
 * are not the same origin — which is also what makes local development work,
 * since the dev server proxies `/api` in the browser but SSR cannot use a
 * browser proxy.
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (request, next) => {
  const isRelative = request.url.startsWith('/');
  if (!isRelative) return next(request);

  const incoming = inject(REQUEST, { optional: true });
  if (!incoming) return next(request); // Browser: relative is already correct.

  // Read off globalThis rather than `process` directly: this file is compiled
  // into the browser bundle too, where node types are not available and the
  // symbol does not exist. The branch is only reachable on the server anyway.
  const override = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.['API_ORIGIN'];

  const origin = override || new URL(incoming.url).origin;

  return next(request.clone({ url: `${origin}${request.url}` }));
};
