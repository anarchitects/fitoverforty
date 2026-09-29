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

  describe('GET /blog/posts/:slug/related', () => {
    it('never includes the post it was asked about', async () => {
      const { status, body } = await get(
        `/blog/posts/${SEEDED.lifting}/related`,
      );
      expect(status).toBe(200);
      expect(body.map((p: { slug: string }) => p.slug)).not.toContain(
        SEEDED.lifting,
      );
    });

    it('tops up from recent posts when the pillar cannot fill the list', async () => {
      // The seeded posts sit in different pillars, so same-pillar alone would
      // return nothing here. Returning an empty list would make every post a
      // dead end until each pillar has several posts in it, which is exactly
      // the state a new blog is in.
      const { body } = await get(`/blog/posts/${SEEDED.lifting}/related`);
      expect(body.length).toBeGreaterThan(0);
      expect(body.map((p: { slug: string }) => p.slug)).toContain(
        SEEDED.protein,
      );
    });

    it('offers nothing for a post that is not published', async () => {
      // Answering with recent posts would confirm the slug exists.
      const { status, body } = await get(`/blog/posts/${HIDDEN.draft}/related`);
      expect(status).toBe(200);
      expect(body).toEqual([]);
    });

    it('never offers a draft or a future-dated post', async () => {
      const { body } = await get(`/blog/posts/${SEEDED.lifting}/related`);
      const slugs = body.map((p: { slug: string }) => p.slug);
      expect(slugs).not.toContain(HIDDEN.draft);
      expect(slugs).not.toContain(HIDDEN.future);
    });

    it('clamps the limit rather than trusting it', async () => {
      // `take` on a public query: an unbounded limit is a way to ask for the
      // whole table one request at a time.
      const { body } = await get(
        `/blog/posts/${SEEDED.lifting}/related?limit=999`,
      );
      expect(body.length).toBeLessThanOrEqual(6);
    });
  });

  describe('GET /blog/pillars', () => {
    it('returns all four in their fixed order, with counts', async () => {
      const { status, body } = await get('/blog/pillars');
      expect(status).toBe(200);
      expect(body.map((p: { slug: string }) => p.slug)).toEqual([
        'physical-fitness',
        'mental-fitness',
        'emotional-fitness',
        'financial-fitness',
      ]);
    });

    it('lists a pillar with no posts rather than omitting it', async () => {
      // Unlike tags, which only exist once something carries them, the four
      // pillars are navigation: a reader who sees three of four learns the
      // wrong thing about what this blog covers.
      const { body } = await get('/blog/pillars');
      const mental = body.find(
        (p: { slug: string }) => p.slug === 'mental-fitness',
      );
      expect(mental).toEqual(
        expect.objectContaining({ name: 'Mental Fitness', postCount: 0 }),
      );
    });

    it('counts only published, already-dated posts', async () => {
      // The draft and the future-dated post inserted above are both filed
      // under a pillar by the backfill, so a naive count would include them.
      const { body } = await get('/blog/pillars');
      const physical = body.find(
        (p: { slug: string }) => p.slug === 'physical-fitness',
      );
      expect(physical.postCount).toBe(2);
    });
  });

  describe('GET /blog/pillars/:slug/posts', () => {
    it('returns the posts filed under a pillar', async () => {
      const { status, body } = await get(
        '/blog/pillars/physical-fitness/posts',
      );
      expect(status).toBe(200);
      expect(body.totalItems).toBe(2);
      const slugs = body.items.map((item: { slug: string }) => item.slug);
      expect(slugs).toEqual([SEEDED.protein, SEEDED.lifting]);
    });

    it('carries the pillar on each summary', async () => {
      const { body } = await get('/blog/pillars/physical-fitness/posts');
      expect(body.items[0].pillar).toEqual({
        slug: 'physical-fitness',
        name: 'Physical Fitness',
      });
    });

    it('hides drafts and future-dated posts, as every read does', async () => {
      const { body } = await get(
        '/blog/pillars/physical-fitness/posts?perPage=50',
      );
      const slugs = body.items.map((item: { slug: string }) => item.slug);
      expect(slugs).not.toContain(HIDDEN.draft);
      expect(slugs).not.toContain(HIDDEN.future);
    });

    it('is an empty page for a pillar nobody has written for', async () => {
      const { status, body } = await get(
        '/blog/pillars/financial-fitness/posts',
      );
      expect(status).toBe(200);
      expect(body.items).toEqual([]);
      expect(body.totalItems).toBe(0);
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
