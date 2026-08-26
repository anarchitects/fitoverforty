import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { createFastifyTestApp } from '../support/create-fastify-test-app';

const SEEDED = {
  lifting: 'why-lifting-after-forty-is-different',
  protein: 'protein-without-the-spreadsheet',
};

const HIDDEN = { draft: 'e2e-draft-post', future: 'e2e-future-post' };

describe('blog read api', () => {
  let app: NestFastifyApplication;
  let dataSource: DataSource;

  const get = async (url: string) => {
    const response = await app.inject({ method: 'GET', url });
    return {
      status: response.statusCode,
      body: response.payload ? JSON.parse(response.payload) : undefined,
    };
  };

  beforeAll(async () => {
    app = await createFastifyTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());

    // One draft and one future-dated post. Both must be invisible to every
    // read endpoint — that filtering is the content source's responsibility,
    // and nothing else in the suite would notice if it regressed.
    await dataSource.query(
      `INSERT INTO "blog"."posts"
         ("slug","title","description","body","status","published_at","reading_time_minutes")
       VALUES
         ($1,'Draft','A draft.','{"blocks":[]}','draft',NULL,1),
         ($2,'Future','Scheduled.','{"blocks":[]}','published',now() + interval '30 days',1)`,
      [HIDDEN.draft, HIDDEN.future],
    );
  });

  afterAll(async () => {
    await dataSource.query(
      `DELETE FROM "blog"."posts" WHERE "slug" = ANY($1)`,
      [[HIDDEN.draft, HIDDEN.future]],
    );
    await app.close();
  });

  describe('GET /blog/posts', () => {
    it('returns published posts newest first, with paging metadata', async () => {
      const { status, body } = await get('/blog/posts');
      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({ page: 1, perPage: 10, totalPages: 1 }),
      );
      const slugs = body.items.map((item: { slug: string }) => item.slug);
      expect(slugs.indexOf(SEEDED.protein)).toBeLessThan(
        slugs.indexOf(SEEDED.lifting),
      );
    });

    it('hides drafts and future-dated posts', async () => {
      const { body } = await get('/blog/posts?perPage=50');
      const slugs = body.items.map((item: { slug: string }) => item.slug);
      expect(slugs).not.toContain(HIDDEN.draft);
      expect(slugs).not.toContain(HIDDEN.future);
      expect(body.totalItems).toBe(2);
    });

    it('paginates', async () => {
      const { body } = await get('/blog/posts?perPage=1&page=2');
      expect(body.items).toHaveLength(1);
      expect(body).toEqual(
        expect.objectContaining({
          page: 2,
          perPage: 1,
          totalItems: 2,
          totalPages: 2,
        }),
      );
      expect(body.items[0].slug).toBe(SEEDED.lifting);
    });

    it('rejects junk paging rather than coercing it', async () => {
      expect((await get('/blog/posts?page=abc')).status).toBe(400);
      expect((await get('/blog/posts?page=0')).status).toBe(400);
      expect((await get('/blog/posts?perPage=500')).status).toBe(400);
    });
  });

  describe('GET /blog/posts/:slug', () => {
    it('returns the full post with blocks and derived headings', async () => {
      const { status, body } = await get(`/blog/posts/${SEEDED.lifting}`);
      expect(status).toBe(200);
      expect(body.body.kind).toBe('blocks');
      expect(body.body.blocks.blocks.length).toBeGreaterThan(0);
      expect(body.headings).toEqual([
        {
          depth: 2,
          id: 'recovery-is-the-constraint',
          text: 'Recovery is the constraint',
        },
        { depth: 2, id: 'load-then-patience', text: 'Load, then patience' },
      ]);
      expect(body.tags.map((t: { slug: string }) => t.slug).sort()).toEqual([
        'recovery',
        'strength',
      ]);
      expect(body.authors[0].slug).toBe('paul');
    });

    it('keeps permitted inline markup through sanitisation', async () => {
      const { body } = await get(`/blog/posts/${SEEDED.lifting}`);
      const text = JSON.stringify(body.body.blocks.blocks);
      expect(text).toContain('<b>Recovery</b>');
      expect(text).not.toContain('<script');
    });

    it('404s for an unknown slug', async () => {
      expect((await get('/blog/posts/nope')).status).toBe(404);
    });

    it('404s for a draft and for a future-dated post, not 200', async () => {
      expect((await get(`/blog/posts/${HIDDEN.draft}`)).status).toBe(404);
      expect((await get(`/blog/posts/${HIDDEN.future}`)).status).toBe(404);
    });
  });

  describe('GET /blog/tags', () => {
    it('lists tags that have a visible post, by name', async () => {
      const { status, body } = await get('/blog/tags');
      expect(status).toBe(200);
      expect(body.map((tag: { slug: string }) => tag.slug)).toEqual([
        'nutrition',
        'recovery',
        'strength',
      ]);
    });
  });

  describe('GET /blog/tags/:slug/posts', () => {
    it('returns only posts carrying that tag', async () => {
      const { status, body } = await get('/blog/tags/recovery/posts');
      expect(status).toBe(200);
      expect(body.totalItems).toBe(1);
      expect(body.items[0].slug).toBe(SEEDED.lifting);
    });

    it('returns an empty page for a tag nothing carries', async () => {
      const { status, body } = await get('/blog/tags/does-not-exist/posts');
      expect(status).toBe(200);
      expect(body.items).toEqual([]);
      expect(body.totalItems).toBe(0);
    });
  });
});
