import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { createFastifyTestApp } from '../support/create-fastify-test-app';

/**
 * The authoring API against a real database.
 *
 * The point of doing this here rather than against mocked repositories is that
 * the interesting claims are database claims: that a future `published_at`
 * hides a post from every read, that unpublishing does too, and that the check
 * constraints on `blog.posts` accept what this service writes. None of that is
 * provable against a fake.
 *
 * The session is faked — see `apps/fitoverforty/test-stubs/README.md`. Sign-in
 * itself is covered by `fitoverforty-frontend-e2e`.
 */

const AUTHOR = {
  id: randomUUID(),
  email: 'e2e-author@example.test',
  name: 'E2E Author',
};

/** Prefixed so the cleanup below can find everything this suite made. */
const PREFIX = 'e2e-publish-';

const helloWorld = {
  blocks: [
    { type: 'header', data: { level: 2, text: 'A heading' } },
    { type: 'paragraph', data: { text: 'Some words in a paragraph.' } },
  ],
};

describe('publish workflow', () => {
  let app: NestFastifyApplication;
  let dataSource: DataSource;

  const call = async (
    method: string,
    url: string,
    payload?: Record<string, unknown>,
  ) => {
    const response = await app.inject({
      method: method as 'GET',
      url,
      ...(payload === undefined ? {} : { payload }),
    });
    return {
      status: response.statusCode,
      body: response.payload ? JSON.parse(response.payload) : undefined,
    };
  };

  const draft = (over: Record<string, unknown> = {}) => ({
    title: 'A Post From The Editor',
    slug: `${PREFIX}${randomUUID().slice(0, 8)}`,
    description: 'Written through the authoring API.',
    body: helloWorld,
    // Every post needs one to publish, so the shared helper carries it.
    // Tests about the pillar itself override or omit it deliberately.
    pillarSlug: 'physical-fitness',
    ...over,
  });

  const create = async (over: Record<string, unknown> = {}) => {
    const { status, body } = await call('POST', '/admin/posts', draft(over));
    expect(status).toBe(201);
    return body;
  };

  /** Inserts a media row directly; uploading is the media suite's business. */
  const insertMedia = async (alt: string): Promise<string> => {
    const key = `${PREFIX}${randomUUID()}.png`;
    const [row] = await dataSource.query(
      `INSERT INTO "blog"."media"
         ("storage_key","url","mime","bytes","width","height","alt")
       VALUES ($1, $2, 'image/png', 100, 800, 600, $3)
       RETURNING "id"`,
      [key, `/media/${key}`, alt],
    );
    return row.id;
  };

  /**
   * Removes everything this suite creates, by email and by slug prefix.
   *
   * Run before as well as after. A suite that crashes mid-way leaves a user
   * row behind, and the next run's `INSERT ... ON CONFLICT DO NOTHING` then
   * silently keeps the old row while the code goes on using the new id — which
   * fails later as a foreign key violation that says nothing about the real
   * cause. Cleaning up front makes a crashed run cost one run, not all of them.
   */
  const cleanUp = async (): Promise<void> => {
    await dataSource.query(`DELETE FROM "blog"."posts" WHERE "slug" LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await dataSource.query(
      `DELETE FROM "blog"."authors"
        WHERE "user_id" IN (SELECT "id" FROM "auth"."users" WHERE "email" = $1)`,
      [AUTHOR.email],
    );
    await dataSource.query(`DELETE FROM "auth"."users" WHERE "email" = $1`, [
      AUTHOR.email,
    ]);
    await dataSource.query(
      `DELETE FROM "blog"."media" WHERE "storage_key" LIKE $1`,
      [`${PREFIX}%`],
    );
    /**
     * By prefix, never by name.
     *
     * This deleted the seeded `recovery` tag once, because that is a perfectly
     * natural tag to write in a test and the seed migration had got there
     * first — which broke three assertions in two other suites and pointed at
     * none of them. A cleanup must only ever remove rows this suite made.
     */
    await dataSource.query(`DELETE FROM "blog"."tags" WHERE "slug" LIKE $1`, [
      `${PREFIX}%`,
    ]);
  };

  beforeAll(async () => {
    app = await createFastifyTestApp({ signedInAs: AUTHOR });
    dataSource = app.get<DataSource>(getDataSourceToken());

    await cleanUp();

    // The author row is created on first write, and needs a user to hang off.
    await dataSource.query(
      `INSERT INTO "auth"."users" ("id","email","name") VALUES ($1,$2,$3)`,
      [AUTHOR.id, AUTHOR.email, AUTHOR.name],
    );
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  describe('the guard', () => {
    let signedOut: NestFastifyApplication;

    beforeAll(async () => {
      signedOut = await createFastifyTestApp({ signedInAs: null });
    });
    afterAll(async () => {
      await signedOut.close();
    });

    it.each([
      ['GET', '/admin/posts'],
      ['POST', '/admin/posts'],
      ['PATCH', `/admin/posts/${randomUUID()}`],
      ['POST', `/admin/posts/${randomUUID()}/publish`],
      ['POST', `/admin/posts/${randomUUID()}/unpublish`],
    ])('rejects %s %s without a session', async (method, url) => {
      const response = await signedOut.inject({
        method: method as 'GET',
        url,
        payload: {},
      });
      // 401 specifically. A 403 would say "signed in but not allowed", and a
      // 500 would say the guard broke — neither is what a signed-out caller
      // should see, and both would hide a regression in the other direction.
      expect(response.statusCode).toBe(401);
    });
  });

  describe('creating a draft', () => {
    it('stores it, derives reading time, and leaves it unpublished', async () => {
      const post = await create();

      expect(post).toEqual(
        expect.objectContaining({
          status: 'draft',
          publishedAt: null,
          scheduled: false,
          readingTimeMinutes: 1,
        }),
      );
      expect(post.id).toEqual(expect.any(String));
      expect(post.body.blocks).toHaveLength(2);
    });

    it('is invisible to the public API', async () => {
      const post = await create();
      const { status } = await call('GET', `/blog/posts/${post.slug}`);
      expect(status).toBe(404);
    });

    it('attributes the post to an author created from the account', async () => {
      const post = await create();
      const [row] = await dataSource.query(
        `SELECT a."name", a."slug", a."user_id"
           FROM "blog"."authors" a
           JOIN "blog"."post_authors" pa ON pa."author_id" = a."id"
          WHERE pa."post_id" = $1`,
        [post.id],
      );
      expect(row).toEqual(
        expect.objectContaining({
          name: AUTHOR.name,
          slug: 'e2e-author',
          user_id: AUTHOR.id,
        }),
      );
    });

    it('upserts tags and returns them', async () => {
      // Prefixed so the cleanup can find them and so they cannot collide with
      // a seeded tag — see cleanUp.
      const post = await create({
        tags: [`${PREFIX}Barbells`, `${PREFIX}Recovery`],
      });
      expect(post.tags).toEqual(
        expect.arrayContaining([
          { slug: `${PREFIX}barbells`, name: `${PREFIX}Barbells` },
          { slug: `${PREFIX}recovery`, name: `${PREFIX}Recovery` },
        ]),
      );
    });

    it('rejects a block type the renderer cannot display', async () => {
      const { status, body } = await call(
        'POST',
        '/admin/posts',
        draft({ body: { blocks: [{ type: 'checklist', data: {} }] } }),
      );
      expect(status).toBe(400);
      // The index is in the message because the author is looking at that block.
      expect(body.message).toMatch(/block 0 \(checklist\)/);
    });

    it('refuses a slug another post already uses', async () => {
      const first = await create();
      const { status, body } = await call(
        'POST',
        '/admin/posts',
        draft({ slug: first.slug }),
      );
      expect(status).toBe(409);
      expect(body.message).toMatch(first.slug);
    });
  });

  describe('updating', () => {
    it('replaces the fields and recomputes reading time', async () => {
      const post = await create();
      const words = Array.from({ length: 450 }, () => 'word').join(' ');

      const { status, body } = await call('PATCH', `/admin/posts/${post.id}`, {
        title: 'Renamed',
        slug: post.slug,
        description: 'Also renamed.',
        body: { blocks: [{ type: 'paragraph', data: { text: words } }] },
      });

      expect(status).toBe(200);
      expect(body.title).toBe('Renamed');
      // 450 words at 200 wpm rounds up to 3.
      expect(body.readingTimeMinutes).toBe(3);
    });

    it('lets a post keep its own slug', async () => {
      // The uniqueness check has to exclude the row being updated, or saving
      // a post twice without renaming it would 409 on itself.
      const post = await create();
      const { status } = await call('PATCH', `/admin/posts/${post.id}`, {
        ...draft({ slug: post.slug }),
        title: 'Same slug, new title',
      });
      expect(status).toBe(200);
    });

    it('strips markup the allowlist does not permit', async () => {
      const post = await create();
      const { body } = await call('PATCH', `/admin/posts/${post.id}`, {
        ...draft({ slug: post.slug }),
        body: {
          blocks: [
            {
              type: 'paragraph',
              data: { text: 'Safe <b>bold</b><script>alert(1)</script>' },
            },
          ],
        },
      });
      expect(body.body.blocks[0].data.text).toBe('Safe <b>bold</b>');
    });

    it('404s for a post that does not exist', async () => {
      const { status } = await call('PATCH', `/admin/posts/${randomUUID()}`, {
        ...draft(),
      });
      expect(status).toBe(404);
    });
  });

  describe('the pillar', () => {
    it('round-trips through create and load', async () => {
      const post = await create({ pillarSlug: 'financial-fitness' });
      expect(post.pillar).toEqual({
        slug: 'financial-fitness',
        name: 'Financial Fitness',
      });

      const { body } = await call('GET', `/admin/posts/${post.id}`);
      expect(body.pillar.slug).toBe('financial-fitness');
    });

    it('can be changed, and cleared back to unfiled', async () => {
      const post = await create();
      const moved = await call('PATCH', `/admin/posts/${post.id}`, {
        ...draft({ slug: post.slug, pillarSlug: 'mental-fitness' }),
      });
      expect(moved.body.pillar.slug).toBe('mental-fitness');

      const cleared = await call('PATCH', `/admin/posts/${post.id}`, {
        ...draft({ slug: post.slug, pillarSlug: null }),
      });
      expect(cleared.body.pillar).toBeNull();
    });

    it('lets a draft be saved without one', async () => {
      // Same position as alt text: an unfinished post can be parked before its
      // author has decided where it belongs.
      const post = await create({ pillarSlug: null });
      expect(post.pillar).toBeNull();
      expect(post.status).toBe('draft');
    });

    it('refuses a slug outside the fixed set, rather than creating one', async () => {
      const { status, body } = await call(
        'POST',
        '/admin/posts',
        draft({ pillarSlug: 'spiritual-fitness' }),
      );
      expect(status).toBe(400);
      expect(body.message).toContain('physical-fitness');
    });

    it('refuses to publish a post that has no pillar', async () => {
      // The whole point of the taxonomy: a published post with no pillar has
      // no home in the navigation and appears in no section a reader browses.
      const post = await create({ pillarSlug: null });
      const { status, body } = await call(
        'POST',
        `/admin/posts/${post.id}/publish`,
      );

      expect(status).toBe(400);
      expect(body.message).toContain('pillar');

      // And it really did not publish.
      const still = await call('GET', `/admin/posts/${post.id}`);
      expect(still.body.status).toBe('draft');
    });
  });

  describe('publishing', () => {
    it('makes the post readable on the public API', async () => {
      const post = await create();
      const { status, body } = await call(
        'POST',
        `/admin/posts/${post.id}/publish`,
      );

      expect(status).toBe(200);
      expect(body.status).toBe('published');
      expect(body.scheduled).toBe(false);

      const published = await call('GET', `/blog/posts/${post.slug}`);
      expect(published.status).toBe(200);
      expect(published.body.slug).toBe(post.slug);
    });

    it('schedules a future post without exposing it', async () => {
      // The claim from §5 that scheduling "comes free": nothing runs at the
      // scheduled time, the read query simply starts matching.
      const post = await create();
      const at = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const { body } = await call('POST', `/admin/posts/${post.id}/publish`, {
        publishedAt: at,
      });
      expect(body).toEqual(
        expect.objectContaining({ status: 'published', scheduled: true }),
      );

      const { status } = await call('GET', `/blog/posts/${post.slug}`);
      expect(status).toBe(404);
    });

    it('shows a backdated post immediately', async () => {
      const post = await create();
      await call('POST', `/admin/posts/${post.id}/publish`, {
        publishedAt: '2024-01-01T00:00:00.000Z',
      });
      const { status } = await call('GET', `/blog/posts/${post.slug}`);
      expect(status).toBe(200);
    });

    it('refuses a hero image with no alt text', async () => {
      const mediaId = await insertMedia('');
      const post = await create({ heroMediaId: mediaId });

      const { status, body } = await call(
        'POST',
        `/admin/posts/${post.id}/publish`,
      );
      expect(status).toBe(400);
      expect(body.message).toMatch(/alt text/i);
    });

    it('accepts a hero once alt text is written on the draft', async () => {
      const mediaId = await insertMedia('');
      const post = await create({ heroMediaId: mediaId });

      await call('PATCH', `/admin/posts/${post.id}`, {
        ...draft({ slug: post.slug }),
        heroMediaId: mediaId,
        heroAlt: 'A barbell on a gym floor.',
      });

      const { status, body } = await call(
        'POST',
        `/admin/posts/${post.id}/publish`,
      );
      expect(status).toBe(200);
      expect(body.hero).toEqual(
        expect.objectContaining({
          mediaId,
          alt: 'A barbell on a gym floor.',
        }),
      );

      // The alt reaches the reader, which is the entire point of requiring it.
      const published = await call('GET', `/blog/posts/${post.slug}`);
      expect(published.body.hero.alt).toBe('A barbell on a gym floor.');
    });
  });

  describe('unpublishing', () => {
    it('removes the post from the public API but keeps its date', async () => {
      const post = await create();
      const { body: published } = await call(
        'POST',
        `/admin/posts/${post.id}/publish`,
      );

      const { status, body } = await call(
        'POST',
        `/admin/posts/${post.id}/unpublish`,
      );
      expect(status).toBe(200);
      expect(body.status).toBe('draft');
      // Retained so republishing after a correction restores the original date
      // rather than silently re-dating the post to today.
      expect(body.publishedAt).toBe(published.publishedAt);

      const gone = await call('GET', `/blog/posts/${post.slug}`);
      expect(gone.status).toBe(404);
    });
  });

  describe('the admin listing', () => {
    it('includes drafts, which is what separates it from the public list', async () => {
      const post = await create();
      const { status, body } = await call('GET', '/admin/posts');

      expect(status).toBe(200);
      const ids = body.map((item: { id: string }) => item.id);
      expect(ids).toContain(post.id);
    });
  });
});
