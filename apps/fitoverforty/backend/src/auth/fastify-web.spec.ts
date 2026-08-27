import type { FastifyReply, FastifyRequest } from 'fastify';
import { requestUrl, sendWebResponse, toWebRequest } from './fastify-web';

function fakeRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    method: 'GET',
    url: '/api/auth/session',
    protocol: 'http',
    headers: { host: 'localhost:3000' },
    body: undefined,
    ...overrides,
  } as unknown as FastifyRequest;
}

function fakeReply() {
  const headers: Record<string, string | string[]> = {};
  const state: { status?: number; payload?: unknown } = {};
  const reply = {
    header(key: string, value: string | string[]) {
      headers[key] = value;
      return reply;
    },
    status(code: number) {
      state.status = code;
      return reply;
    },
    send(payload: unknown) {
      state.payload = payload;
      return reply;
    },
  };
  return { reply: reply as unknown as FastifyReply, headers, state };
}

describe('requestUrl', () => {
  it('builds an absolute URL from the host header', () => {
    expect(requestUrl(fakeRequest()).toString()).toBe(
      'http://localhost:3000/api/auth/session',
    );
  });

  it('prefers x-forwarded-proto, so links behind TLS termination stay https', () => {
    const request = fakeRequest({
      headers: { host: 'fitoverforty.co.uk', 'x-forwarded-proto': 'https' },
    });
    expect(requestUrl(request).protocol).toBe('https:');
  });
});

describe('toWebRequest', () => {
  it('carries headers across', () => {
    const request = toWebRequest(
      fakeRequest({ headers: { host: 'localhost', cookie: 'a=1' } }),
    );
    expect(request.headers.get('cookie')).toBe('a=1');
  });

  it('re-serialises the parsed body, because Fastify has already consumed the stream', async () => {
    const request = toWebRequest(
      fakeRequest({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        body: { email: 'someone@example.com', password: 'hunter2hunter2' },
      }),
    );

    await expect(request.json()).resolves.toEqual({
      email: 'someone@example.com',
      password: 'hunter2hunter2',
    });
  });

  it('sends no body on GET, which Request would otherwise reject', () => {
    expect(() =>
      toWebRequest(fakeRequest({ body: { nope: true } })),
    ).not.toThrow();
  });

  it('passes a string body through unchanged rather than double-encoding it', async () => {
    const request = toWebRequest(
      fakeRequest({ method: 'POST', body: '{"already":"json"}' }),
    );
    await expect(request.text()).resolves.toBe('{"already":"json"}');
  });
});

describe('sendWebResponse', () => {
  it('copies status and ordinary headers', async () => {
    const { reply, headers, state } = fakeReply();
    await sendWebResponse(
      reply,
      new Response('{"ok":true}', {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(state.status).toBe(201);
    expect(headers['content-type']).toBe('application/json');
    expect(state.payload).toBe('{"ok":true}');
  });

  /**
   * The reason `getSetCookie()` exists in the bridge at all. `forEach` folds
   * repeated headers into one comma-joined string, which for Set-Cookie is a
   * malformed header the browser drops — a sign-in that returns 200 and
   * silently leaves the user signed out.
   */
  it('keeps multiple set-cookie headers separate', async () => {
    const { reply, headers } = fakeReply();
    const response = new Response(null, { status: 200 });
    response.headers.append('set-cookie', 'session=abc; Path=/; HttpOnly');
    response.headers.append('set-cookie', 'csrf=def; Path=/');

    await sendWebResponse(reply, response);

    expect(headers['set-cookie']).toEqual([
      'session=abc; Path=/; HttpOnly',
      'csrf=def; Path=/',
    ]);
  });

  it('sends null rather than an empty string for an empty body', async () => {
    const { reply, state } = fakeReply();
    await sendWebResponse(reply, new Response(null, { status: 204 }));
    expect(state.payload).toBeNull();
  });
});
