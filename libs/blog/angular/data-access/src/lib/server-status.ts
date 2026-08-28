import { inject, RESPONSE_INIT } from '@angular/core';

/**
 * Sets the HTTP status of a server-rendered response.
 *
 * @angular/ssr builds one `ResponseInit` before rendering and passes that same
 * object to `new Response(html, responseInit)` afterwards, so mutating it
 * during render reaches the wire. In the browser the token is absent and this
 * is a no-op.
 *
 * Without this, a not-found page is served as 200 with "Not found" in the body
 * — which readers cannot tell apart, but crawlers and monitoring very much can.
 */
export function setServerStatus(status: number): void {
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  if (responseInit) {
    responseInit.status = status;
  }
}
