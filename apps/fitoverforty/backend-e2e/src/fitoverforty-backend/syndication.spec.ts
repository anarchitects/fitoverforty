import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createFastifyTestApp } from '../support/create-fastify-test-app';

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
      robotsTag: response.headers['x-robots-tag'] as string | undefined,
      body: response.payload,
    };
  };

  beforeAll(async () => {
    process.env['SITE_URL'] = 'https://example.test';
    // The feed and sitemap describe a site that wants to be found, so this
    // suite runs as the public site does. The refusing branch is exercised in
    // its own describe below, which sets this back and restores it.
    process.env['ALLOW_INDEXING'] = 'true';
    app = await createFastifyTestApp();
  });

  afterAll(async () => {
    delete process.env['SITE_URL'];
    delete process.env['ALLOW_INDEXING'];
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
        // Both static pages shipped after this sitemap was written and neither
        // was added to it, which is the failure this list now catches: a route
        // exists, renders, and is not offered to anything that reads sitemaps.
        '/about',
        '/privacy',
      ]) {
        expect(body).toContain(`<loc>https://example.test${path}</loc>`);
      }
    });

    it('lists an author page for every author with a published post', async () => {
      const { body } = await get('/sitemap.xml');
      // There is no /blog/authors index to crawl from — that is a decision,
      // not an omission — so the sitemap is the only route by which these
      // pages are discoverable without following a byline.
      for (const slug of ['paul', 'johan']) {
        expect(body).toContain(
          `<loc>https://example.test/blog/author/${slug}</loc>`,
        );
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

    it('sends no X-Robots-Tag when indexing is allowed', async () => {
      expect((await get('/robots.txt')).robotsTag).toBeUndefined();
    });
  });

  /**
   * An instance that does not want to be indexed. ALLOW_INDEXING is read per
   * response rather than captured when the hook is registered, so both
   * branches can be exercised against the one app.
   */
  describe('when ALLOW_INDEXING is not set', () => {
    beforeAll(() => {
      delete process.env['ALLOW_INDEXING'];
    });

    afterAll(() => {
      process.env['ALLOW_INDEXING'] = 'true';
    });

    it('sends noindex on every response, not only on documents', async () => {
      // The header is what keeps the site out of an index, so it has to be on
      // whatever a crawler actually fetched. Asserted on two unrelated routes
      // because a hook scoped to one of them would pass a narrower test and
      // leave the rendered pages — the ones that matter — uncovered.
      for (const path of ['/robots.txt', '/sitemap.xml', '/blog/feed.xml']) {
        expect((await get(path)).robotsTag).toBe('noindex, nofollow');
      }
    });

    it('stops advertising the sitemap', async () => {
      const { body } = await get('/robots.txt');
      expect(body).not.toContain('Sitemap:');
    });

    it('still lets a crawler in, so it can read the noindex', async () => {
      // Deliberately NOT `Disallow: /`. A crawler told not to fetch a page
      // never sees the header telling it not to index it, and can still list
      // the URL from a link elsewhere — so blocking the crawl is the one
      // change here that would defeat the whole purpose.
      const { body } = await get('/robots.txt');
      expect(body).toContain('Allow: /');
      expect(body).not.toContain('Disallow: /\n');
      expect(body).toContain('Disallow: /admin');
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
