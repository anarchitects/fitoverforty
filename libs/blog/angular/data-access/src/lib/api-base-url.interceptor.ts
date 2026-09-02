import { inject, REQUEST } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * The port this process is listening on, mirroring `main.ts`'s own default.
 *
 * Both sides read `PORT`, so the two agree without either being told about
 * the other.
 */
const DEFAULT_PORT = '3000';

/**
 * Makes relative API URLs work during server-side rendering.
 *
 * In the browser a request to `/api/blog/posts` resolves against the current
 * page. On the server there is no page, so the same URL has nothing to resolve
 * against and the request fails.
 *
 * The base has to be **loopback**, not the origin of the incoming request.
 * Behind Nginx that origin is the public one — `https://the-blog.example` —
 * and using it sends every server-rendered page's data fetch out of the
 * machine and back in through the proxy. Which fails outright unless the
 * server can resolve its own public name and trust its own certificate, and
 * when it does work costs a full network round trip per render. The renderer
 * and the API are the same Nest process; it should talk to itself.
 *
 * This was found by running the built artefact behind a proxy for the first
 * time (#65): pages rendered, but every one answered 503 with
 * `ENOTFOUND the-blog.example` in the log, because a test hostname had no DNS
 * — exactly what a server that cannot resolve its own name would do.
 *
 * `API_ORIGIN` overrides the base for deployments where the renderer and the
 * API genuinely are not the same process.
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (request, next) => {
  const isRelative = request.url.startsWith('/');
  if (!isRelative) return next(request);

  const incoming = inject(REQUEST, { optional: true });
  if (!incoming) return next(request); // Browser: relative is already correct.

  // Read off globalThis rather than `process` directly: this file is compiled
  // into the browser bundle too, where node types are not available and the
  // symbol does not exist. The branch is only reachable on the server anyway.
  const env = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;

  const origin =
    env?.['API_ORIGIN'] || `http://127.0.0.1:${env?.['PORT'] || DEFAULT_PORT}`;

  return next(request.clone({ url: `${origin}${request.url}` }));
};
