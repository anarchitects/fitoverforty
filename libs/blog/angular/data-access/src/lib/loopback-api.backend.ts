import {
  Injectable,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import {
  FetchBackend,
  HttpBackend,
  type HttpEvent,
  type HttpRequest,
} from '@angular/common/http';
import type { Observable } from 'rxjs';

/**
 * The port this process is listening on, mirroring `main.ts`'s own default.
 *
 * Both sides read `PORT`, so the two agree without either being told about
 * the other.
 */
const DEFAULT_PORT = '3000';

/**
 * Where the server should address its own API.
 *
 * Read per request rather than at module scope: this file is evaluated when
 * the SSR bundle loads, which on a deployed box is before anything has had a
 * chance to read a `.env` beside `main.js`.
 */
function apiOrigin(): string {
  // Read off globalThis rather than `process` directly, so the file stays
  // loadable if it is ever pulled into a browser bundle by a barrel import.
  const env = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;

  return (
    env?.['API_ORIGIN'] || `http://127.0.0.1:${env?.['PORT'] || DEFAULT_PORT}`
  );
}

/**
 * Makes relative API URLs work during server-side rendering, **below** the
 * interceptor chain.
 *
 * In the browser a request to `/api/blog/posts` resolves against the current
 * page. On the server there is no page, so the same URL has nothing to resolve
 * against and the request fails. Something has to prefix an origin.
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
 *
 * ## Why this is a backend and not an interceptor
 *
 * It was an interceptor until #80, and that is why the HTTP transfer cache
 * never worked. Angular builds the chain as user interceptors first, root
 * interceptors last:
 *
 * ```js
 * Array.from(new Set([
 *   ...injector.get(HTTP_INTERCEPTOR_FNS),
 *   ...injector.get(HTTP_ROOT_INTERCEPTOR_FNS, []),
 * ]))
 * ```
 *
 * `provideClientHydration` registers the transfer cache in the *root* list, so
 * it always ran after ours — seeing `http://127.0.0.1:3000/api/blog/posts` on
 * the server and `/api/blog/posts` in the browser. The cache key is a hash
 * over `[method, responseType, url, body, params]`, so two URLs meant two keys
 * and a guaranteed miss: every page fetched its data once while rendering and
 * again immediately after hydration.
 *
 * A backend runs after every interceptor, root ones included, so the transfer
 * cache sees the relative URL on both sides and the keys match by
 * construction. `HTTP_TRANSFER_CACHE_ORIGIN_MAP` is Angular's own answer to
 * this shape of problem and cannot help here: it maps origin to origin, and
 * the empty string a relative URL would need is falsy, so the lookup
 * short-circuits and returns the URL unchanged.
 *
 * It *extends* `FetchBackend` rather than wrapping one, because Angular warns
 * (NG02801) when the backend in use during SSR is not a `FetchBackend`. A
 * delegating wrapper fails that `instanceof` check and produces a "HttpClient
 * is not configured to use fetch" warning that is simply untrue.
 */
@Injectable()
export class LoopbackApiBackend extends FetchBackend {
  override handle(
    request: HttpRequest<unknown>,
  ): Observable<HttpEvent<unknown>> {
    if (!request.url.startsWith('/')) return super.handle(request);

    return super.handle(request.clone({ url: `${apiOrigin()}${request.url}` }));
  }
}

/**
 * Server-only. Belongs in `app.config.server.ts`, never in `app.config.ts` —
 * in the browser a relative URL is already correct, and overriding the backend
 * there would rewrite every request to loopback.
 *
 * Overrides the `HttpBackend` that `withFetch()` aliases to `FetchBackend`.
 * `mergeApplicationConfig` appends the server providers after the shared ones,
 * so this wins.
 */
export function provideLoopbackApi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    LoopbackApiBackend,
    { provide: HttpBackend, useExisting: LoopbackApiBackend },
  ]);
}
