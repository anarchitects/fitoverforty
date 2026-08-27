import type { FastifyRequest } from 'fastify';

/**
 * The public origin of the site, for absolute URLs in the feed and sitemap.
 *
 * `SITE_URL` wins, because behind a proxy the request's own host is the
 * internal one and every canonical URL would point somewhere unreachable.
 * Falling back to the request keeps local development working without config.
 */
export function siteOrigin(request: FastifyRequest): string {
  const configured = process.env['SITE_URL'];
  if (configured) return configured.replace(/\/+$/, '');

  const forwardedProto = request.headers['x-forwarded-proto'];
  const proto =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ??
    request.protocol ??
    'http';
  const host = request.headers.host ?? 'localhost';
  return `${proto}://${host}`;
}

/** Escapes text for inclusion in XML character data or an attribute. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
