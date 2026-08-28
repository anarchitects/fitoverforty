import { RESPONSE_INIT, runInInjectionContext, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { loaded } from './loaded';
import { setServerStatus } from './server-status';

describe('loaded', () => {
  let errors: unknown[][];
  let spy: typeof console.error;

  beforeEach(() => {
    errors = [];
    spy = console.error;
    console.error = (...args: unknown[]) => void errors.push(args);
  });
  afterEach(() => {
    console.error = spy;
  });

  it('wraps a resolved value', async () => {
    await expect(loaded(Promise.resolve([1, 2]))).resolves.toEqual({
      ok: true,
      data: [1, 2],
    });
  });

  it('turns a rejection into a value rather than propagating it', async () => {
    // Angular cancels a navigation whose resolver throws, which on a first
    // load leaves the browser on a blank page. An API blip must not become a
    // white screen, so failure has to be something the page can render.
    await expect(loaded(Promise.reject(new Error('boom')))).resolves.toEqual({
      ok: false,
    });
  });

  it('logs the cause rather than swallowing it silently', async () => {
    await loaded(Promise.reject(new Error('boom')));
    expect(errors).toHaveLength(1);
    expect(String(errors[0][0])).toContain('failed to load');
  });

  it('distinguishes empty content from a failure', async () => {
    // Telling a reader — or a crawler — that a blog is empty when the API is
    // down is worse than admitting the failure.
    const empty = await loaded(Promise.resolve([]));
    const failed = await loaded(Promise.reject(new Error('down')));
    expect(empty).toEqual({ ok: true, data: [] });
    expect(failed.ok).toBe(false);
  });
});

describe('setServerStatus', () => {
  it('sets the status on the response init the server will use', () => {
    // @angular/ssr passes this same object to `new Response(html, init)` after
    // rendering, so mutating it during render reaches the wire.
    const responseInit: ResponseInit = { status: 200 };
    TestBed.configureTestingModule({
      providers: [{ provide: RESPONSE_INIT, useValue: responseInit }],
    });
    runInInjectionContext(TestBed.inject(Injector), () => setServerStatus(404));
    expect(responseInit.status).toBe(404);
  });

  it('is a no-op in the browser, where the token is absent', () => {
    // Without the optional injection this would throw on every client render.
    TestBed.configureTestingModule({ providers: [] });
    expect(() =>
      runInInjectionContext(TestBed.inject(Injector), () =>
        setServerStatus(404),
      ),
    ).not.toThrow();
  });
});
