import { APP_ID, TransferState } from '@angular/core';
import {
  HttpClient,
  provideHttpClient,
  withFetch,
  withInterceptors,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { PlatformLocation } from '@angular/common';
import { provideClientHydration } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideLoopbackApi } from './loopback-api.backend';

/**
 * The public origin a request arrives on behind Nginx. Nothing may be
 * addressed at it from inside the server: the whole point of the backend is
 * that the process talks to itself.
 */
const PUBLIC_ORIGIN = 'https://the-blog.example';

/**
 * Only the four fields `relativeUrlsTransformerInterceptorFn` reads, which are
 * the same four `renderOrigin()` reads. Anything else on `PlatformLocation`
 * would be scenery.
 */
function platformLocationAt(origin: string): Partial<PlatformLocation> {
  const { protocol, hostname, port } = new URL(origin);
  return { protocol, hostname, port, href: `${origin}/blog` };
}

const POSTS_URL = '/api/blog/posts';
const POSTS_BODY = { items: [{ slug: 'protein-without-the-spreadsheet' }] };

/** Whatever the browser's real `APP_ID` is, both halves have to agree on it. */
const APP_ID_FOR_TEST = 'ng';

/**
 * `LoopbackApiBackend` extends the real `FetchBackend`, so the thing to stub
 * is `fetch` itself. That also makes the assertions honest: they are about the
 * URL the process actually requests, not one recorded by a substitute.
 */
let fetched: string[] = [];

function stubFetch(): void {
  fetched = [];
  vi.stubGlobal('fetch', (url: string) => {
    fetched.push(url);
    return Promise.resolve(
      new Response(JSON.stringify(POSTS_BODY), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
}

/** Angular's own switch for "this code is running during SSR". */
function setServerMode(on: boolean): void {
  (globalThis as { ngServerMode?: boolean }).ngServerMode = on;
}

function serverProviders(extra: unknown[] = []) {
  return [
    provideHttpClient(withFetch()),
    provideLoopbackApi(),
    { provide: PlatformLocation, useValue: platformLocationAt(PUBLIC_ORIGIN) },
    ...(extra as never[]),
  ];
}

/** Issues one GET and waits for it, so the fetch has definitely happened. */
function get(url: string): Promise<unknown> {
  return firstValueFrom(TestBed.inject(HttpClient).get(url));
}

describe('LoopbackApiBackend', () => {
  const original = { ...process.env };

  beforeEach(() => {
    setServerMode(true);
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setServerMode(false);
    for (const key of ['API_ORIGIN', 'PORT']) {
      delete process.env[key];
      if (original[key] !== undefined) process.env[key] = original[key];
    }
  });

  it('addresses loopback during SSR, not the public origin', async () => {
    // The failure this guards against renders a page and then answers 503:
    // the fetch leaves the machine for a name the machine cannot resolve.
    //
    // The URL arrives already absolute because platform-server's own root
    // interceptor resolved it against `PlatformLocation` first — that is the
    // shape this backend has to recognise, not the relative one.
    delete process.env['API_ORIGIN'];
    process.env['PORT'] = '8080';
    TestBed.configureTestingModule({ providers: serverProviders() });

    await expect(get(`${PUBLIC_ORIGIN}${POSTS_URL}`)).resolves.toEqual(
      POSTS_BODY,
    );
    expect(fetched).toEqual([`http://127.0.0.1:8080${POSTS_URL}`]);
  });

  it('still handles a relative URL, if nothing above it absolutised one', async () => {
    delete process.env['API_ORIGIN'];
    process.env['PORT'] = '8080';
    TestBed.configureTestingModule({ providers: serverProviders() });

    await get(POSTS_URL);
    expect(fetched).toEqual([`http://127.0.0.1:8080${POSTS_URL}`]);
  });

  it('keeps the path, query and fragment when it swaps the origin', async () => {
    delete process.env['API_ORIGIN'];
    process.env['PORT'] = '8080';
    TestBed.configureTestingModule({ providers: serverProviders() });

    await get(`${PUBLIC_ORIGIN}/api/blog/posts?page=2`);
    expect(fetched).toEqual(['http://127.0.0.1:8080/api/blog/posts?page=2']);
  });

  it('falls back to the port main.ts defaults to', async () => {
    delete process.env['API_ORIGIN'];
    delete process.env['PORT'];
    TestBed.configureTestingModule({ providers: serverProviders() });

    await get(`${PUBLIC_ORIGIN}${POSTS_URL}`);
    expect(fetched).toEqual([`http://127.0.0.1:3000${POSTS_URL}`]);
  });

  it('honours API_ORIGIN when the API is a different process', async () => {
    process.env['API_ORIGIN'] = 'http://10.0.0.4:9000';
    process.env['PORT'] = '8080';
    TestBed.configureTestingModule({ providers: serverProviders() });

    await get(`${PUBLIC_ORIGIN}${POSTS_URL}`);
    expect(fetched).toEqual([`http://10.0.0.4:9000${POSTS_URL}`]);
  });

  it('leaves a genuinely third-party URL alone', async () => {
    // Only this render's own origin is redirected inwards. Somebody else's
    // host is somebody else's host, whatever path it carries.
    process.env['PORT'] = '8080';
    TestBed.configureTestingModule({ providers: serverProviders() });

    await get('https://elsewhere.example/api/thing');
    expect(fetched).toEqual(['https://elsewhere.example/api/thing']);
  });

  it('rewrites below the interceptor chain, so interceptors see the relative URL', async () => {
    // This is the property the whole change exists for. The transfer cache is
    // a *root* interceptor, and root interceptors run last — so whatever the
    // last user interceptor sees is what the cache will key on. If the rewrite
    // ever moves back above the chain, this is what notices.
    const seen: string[] = [];
    const spy: HttpInterceptorFn = (request, next) => {
      seen.push(request.url);
      return next(request);
    };

    delete process.env['API_ORIGIN'];
    process.env['PORT'] = '8080';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch(), withInterceptors([spy])),
        provideLoopbackApi(),
        {
          provide: PlatformLocation,
          useValue: platformLocationAt(PUBLIC_ORIGIN),
        },
      ],
    });

    await get(POSTS_URL);
    expect(seen).toEqual([POSTS_URL]);
    expect(fetched).toEqual([`http://127.0.0.1:8080${POSTS_URL}`]);
  });

  it('produces a transfer cache the browser actually hits', async () => {
    // #80: every page fetched its data twice, once while rendering and once
    // after hydration, because the server keyed the response by an absolute
    // URL and the browser looked it up by a relative one.
    delete process.env['API_ORIGIN'];
    process.env['PORT'] = '8080';
    TestBed.configureTestingModule({
      providers: serverProviders([provideClientHydration()]),
    });

    await get(POSTS_URL);
    expect(fetched).toEqual([`http://127.0.0.1:8080${POSTS_URL}`]);

    // What the server would serialize into the state script.
    const serialized = TestBed.inject(TransferState).toJson();
    expect(serialized).not.toBe('{}');

    // Now the browser, handed that state and none of the server's providers.
    TestBed.resetTestingModule();
    setServerMode(false);
    fetched = [];

    const script = document.createElement('script');
    // `TransferState` looks the script up by `${APP_ID}-state`, and TestBed's
    // APP_ID is not the browser default — so provide it rather than assume it.
    script.id = `${APP_ID_FOR_TEST}-state`;
    script.type = 'application/json';
    script.textContent = serialized;
    document.body.appendChild(script);

    try {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withFetch()),
          provideClientHydration(),
          { provide: APP_ID, useValue: APP_ID_FOR_TEST },
        ],
      });

      await expect(get(POSTS_URL)).resolves.toEqual(POSTS_BODY);
      expect(fetched).toEqual([]);
    } finally {
      script.remove();
    }
  });
});
