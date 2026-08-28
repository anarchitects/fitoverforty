import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Better Auth speaks the web-standard `Request`/`Response` pair; Fastify does
 * not. These two functions are the whole bridge.
 *
 * Nest's Fastify adapter has no built-in equivalent, and the conversion has
 * two details that are easy to get wrong and hard to notice, both called out
 * below: the request body and `set-cookie`.
 */

/** Builds the absolute URL Fastify was asked for. */
export function requestUrl(request: FastifyRequest): URL {
  const forwardedProto = request.headers['x-forwarded-proto'];
  const proto =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ??
    request.protocol ??
    'http';
  const host = request.headers.host ?? 'localhost';
  return new URL(request.url, `${proto}://${host}`);
}

export function toWebRequest(request: FastifyRequest): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(key, entry);
    } else {
      headers.append(key, String(value));
    }
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  /**
   * Fastify has already parsed and consumed the body by the time a handler
   * runs, so `request.raw` is a spent stream — reading it here yields nothing
   * and every sign-in fails with an empty-credentials error. Re-serialising
   * the parsed body is the way back to something `Request` can take.
   */
  const body =
    hasBody && request.body !== undefined && request.body !== null
      ? typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body)
      : undefined;

  return new Request(requestUrl(request), { method, headers, body });
}

export async function sendWebResponse(
  reply: FastifyReply,
  response: Response,
): Promise<void> {
  /**
   * `Headers.forEach` folds repeated headers into one comma-joined value.
   * For most headers that is harmless; for `set-cookie` it produces a single
   * malformed header, and the session cookie silently never lands. Node's
   * `getSetCookie()` is the only accessor that keeps them separate, so those
   * are pulled out first and the rest copied normally.
   */
  const setCookie = response.headers.getSetCookie?.() ?? [];

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    reply.header(key, value);
  });

  if (setCookie.length > 0) {
    reply.header('set-cookie', setCookie);
  }

  reply.status(response.status);
  const text = await response.text();
  reply.send(text.length > 0 ? text : null);
}
