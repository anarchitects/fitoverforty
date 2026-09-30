import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createFastifyTestApp } from '../support/create-fastify-test-app';
import { FIT_OVER_FORTY } from '@fitoverforty/site-ts';

/**
 * The test app builds AppModule directly, so there is no /api global prefix —
 * these routes are excluded from it in main.ts anyway, which is the point.
 */
describe('syndication', () => {
  let app: NestFastifyApplication;

  const get = async (url: string) => {
    const response = await app.inject({ method: 'GET', url });
    return {
      status: response.statusCode,
      contentType: response.headers['content-type'] as string,
      body: response.payload,
    };
  };

  beforeAll(async () => {
    process.env['SITE_URL'] = 'https://example.test';
    app = await createFastifyTestApp();
  });

  afterAll(async () => {
    delete process.env['SITE_URL'];
    await app.close();
  });

  describe('GET /blog/feed.xml', () => {
    it('serves well-formed RSS with the right content type', async () => {
      const { status, contentType, body } = await get('/blog/feed.xml');
      expect(status).toBe(200);
      expect(contentType).toContain('application/rss+xml');
      expect(body).toContain('<rss version="2.0"');
      expect(body).toContain(
        '<atom:link href="https://example.test/blog/feed.xml" rel="self"',
      );
    });

    it('titles the channel from the injected site identity', async () => {
      // The name and the description were literals in this controller until
      // they became configuration. Asserted through a real request rather
      // than against the constant, because what this proves is the wiring:
      // the app provides SITE_IDENTITY globally, and a library that no longer
      // knows the site's name gets told it. Without the provider the route
      // does not answer at all.
      const { body } = await get('/blog/feed.xml');
      expect(body).toContain(`<title>${FIT_OVER_FORTY.name}</title>`);
      expect(body).toContain(
        `<description>${FIT_OVER_FORTY.description}</description>`,
      );
    });

    it('lists published posts with permalink guids and RFC-822 dates', async () => {
      const { body } = await get('/blog/feed.xml');
      expect(body).toContain(
        '<guid isPermaLink="true">https://example.test/blog/why-lifting-after-forty-is-different</guid>',
      );
      // RFC 822, which is what RSS requires — not ISO 8601.
      expect(body).toMatch(
        /<pubDate>\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT<\/pubDate>/,
      );
    });

    it('carries descriptions rather than full bodies', async () => {
      const { body } = await get('/blog/feed.xml');
      expect(body).toContain(
        'What actually changes in your forties, and what to do about it.',
      );
      // A phrase that only appears in the post body.
      expect(body).not.toContain('Sleep is training');
    });
  });

  describe('GET /sitemap.xml', () => {
    it('lists the static pages, every tag archive and every post', async () => {
      const { status, contentType, body } = await get('/sitemap.xml');
      expect(status).toBe(200);
      expect(contentType).toContain('application/xml');
      for (const path of [
        '/',
        '/blog',
        '/blog/tags',
        '/contact',
        '/blog/tag/strength',
        '/blog/why-lifting-after-forty-is-different',
      ]) {
        expect(body).toContain(`<loc>https://example.test${path}</loc>`);
      }
    });

    it('does not advertise the admin area', async () => {
      const { body } = await get('/sitemap.xml');
      expect(body).not.toContain('/admin');
    });
  });

  describe('GET /robots.txt', () => {
    it('disallows admin and points at the sitemap', async () => {
      const { status, contentType, body } = await get('/robots.txt');
      expect(status).toBe(200);
      expect(contentType).toContain('text/plain');
      expect(body).toContain('Disallow: /admin');
      expect(body).toContain('Sitemap: https://example.test/sitemap.xml');
    });
  });

  describe('GET /blog/tags', () => {
    it('reports how many published posts carry each tag', async () => {
      const { body } = await get('/blog/tags');
      const tags = JSON.parse(body) as {
        slug: string;
        postCount: number;
      }[];
      expect(tags.map((tag) => tag.slug)).toEqual([
        'nutrition',
        'recovery',
        'strength',
      ]);
      expect(tags.every((tag) => tag.postCount >= 1)).toBe(true);
    });
  });

  describe('GET /blog/posts/refs', () => {
    it('is matched as its own route, not as a post slug', async () => {
      const { status, body } = await get('/blog/posts/refs');
      expect(status).toBe(200);
      const refs = JSON.parse(body) as { slug: string }[];
      expect(refs.map((ref) => ref.slug)).toContain(
        'why-lifting-after-forty-is-different',
      );
    });
  });
});
