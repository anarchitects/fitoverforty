import { AngularNodeAppEngine } from '@angular/ssr/node';

/**
 * SSR entry for the Angular build.
 *
 * The engine is constructed here, inside the Angular bundle, so that it shares
 * a single Angular instance with the application. Constructing it on the Nest
 * side would resolve a second copy of @angular/core from node_modules and DI
 * would fail with "No provider found for InjectionToken", because token
 * identities differ between the two copies.
 *
 * Allowed hosts are read from the environment rather than baked in at build
 * time, so the same artifact can be deployed against different hostnames.
 */
const allowedHosts = (process.env['WEB_ALLOWED_HOSTS'] ?? 'localhost,127.0.0.1')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

export const angularAppEngine = new AngularNodeAppEngine({
  /**
   * Nginx terminates TLS and proxies plain HTTP to this process, so the scheme
   * is the one thing the app cannot work out for itself — without this, every
   * absolute URL it renders comes out `http://`. Nginx overwrites
   * `X-Forwarded-Proto` with `$scheme`, so the value is the edge's, not the
   * caller's.
   *
   * `x-forwarded-host` is deliberately *not* trusted. `Host` already carries
   * the public hostname, so trusting the forwarded copy adds a second
   * caller-supplied input for nothing. What constrains `Host` is Nginx's
   * `default_server` block rejecting unmatched names, plus `allowedHosts`
   * below — not the header itself.
   *
   * Angular's guidance is to enable this only behind a proxy that overrides
   * these headers, precisely because a spoofed one becomes an SSRF vector:
   * https://angular.dev/best-practices/security#configuring-trusted-proxy-headers
   */
  trustProxyHeaders: ['x-forwarded-proto'],
  allowedHosts,
});

export default angularAppEngine;
