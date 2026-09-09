import {
  Injectable,
  inject,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import { PlatformLocation } from '@angular/common';
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
 * Sends the renderer's own API calls to loopback, **below** the interceptor
 * chain.
 *
 * In the browser a request to `/api/blog/posts` resolves against the current
 * page. On the server there is no page, so something has to supply an origin,
 * and `@angular/platform-server` already does: it registers
 * `relativeUrlsTransformerInterceptorFn`, which resolves relative URLs against
 * `PlatformLocation` — the origin the page was requested on. This backend runs
 * after that, and swaps that origin for loopback.
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
 * Root interceptor order is what makes this work, and it is decided by
 * provider order: `provideClientHydration()` is in `app.config.ts` and
 * `provideServerRendering()` in `app.config.server.ts`, which `merge`
 * appends second — so the transfer cache keys the request before
 * platform-server absolutises it. Confirmed the other way round too, on
 * staging before the fix: the entry was keyed
 * `http://127.0.0.1:3001/api/blog/posts`, the loopback URL our *user*
 * interceptor produced, not the request origin platform-server would have
 * produced afterwards.
 *
 * It *extends* `FetchBackend` rather than wrapping one, because Angular warns
 * (NG02801) when the backend in use during SSR is not a `FetchBackend`. A
 * delegating wrapper fails that `instanceof` check and produces a "HttpClient
 * is not configured to use fetch" warning that is simply untrue.
 */
@Injectable()
export class LoopbackApiBackend extends FetchBackend {
  private readonly location = inject(PlatformLocation);

  override handle(
    request: HttpRequest<unknown>,
  ): Observable<HttpEvent<unknown>> {
    const url = toLoopback(request.url, renderOrigin(this.location));
    if (url === request.url) return super.handle(request);

    return super.handle(request.clone({ url }));
  }
}

/**
 * The origin the page being rendered was requested on, exactly as
 * `relativeUrlsTransformerInterceptorFn` computes it — the two have to agree
 * or `toLoopback` stops recognising the URLs that interceptor produces.
 *
 * `null` before the render has a location to speak of, which is the same
 * condition that makes the interceptor leave the URL alone.
 */
function renderOrigin(location: PlatformLocation): string | null {
  const { protocol, hostname, port } = location;
  if (!protocol.startsWith('http')) return null;

  return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
}

function toLoopback(url: string, origin: string | null): string {
  // Belt and braces: reachable only if platform-server ever stops absolutising
  // relative URLs before the backend sees them.
  if (url.startsWith('/')) return `${apiOrigin()}${url}`;

  if (origin === null || !url.startsWith(`${origin}/`)) return url;

  return `${apiOrigin()}${url.slice(origin.length)}`;
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
