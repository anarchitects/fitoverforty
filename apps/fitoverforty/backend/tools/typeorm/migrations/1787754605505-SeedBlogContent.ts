import { MigrationInterface, QueryRunner } from 'typeorm';
import type { OutputData } from '@fitoverforty/content-model';
import { readingTimeMinutes, sanitiseBody } from '../../../src/blog/content';

/**
 * Phase A content, seeded the same way the contact form config is.
 *
 * This is a stopgap: Phase B replaces it with an authoring UI writing to these
 * same tables, so nothing here is thrown away when that lands.
 *
 * Bodies go through sanitiseBody deliberately — seeded content should not be
 * able to contain anything an author could not have published through the API.
 *
 * **Every insert names its columns explicitly, and that is load-bearing.**
 * This originally saved through the TypeORM entities, which meant it did not
 * have a fixed column list at all — it had whatever `AuthorEntity` happened to
 * declare the day it ran. Adding `authors.user_id` in a *later* migration
 * therefore broke this *earlier* one: the entity gained the column, this insert
 * started naming it, and it does not exist yet at this point in the sequence.
 * The whole run is one transaction, so the rollback left a completely empty
 * database and CI failed with "relation blog.posts does not exist" — a symptom
 * pointing nowhere near the cause.
 *
 * A migration has to mean the same thing forever. Entities do not; they mean
 * whatever HEAD says today. So nothing below reads an entity, and the schema
 * version is a literal rather than the CURRENT_BODY_SCHEMA_VERSION constant,
 * which is free to move without silently re-labelling this seeded content.
 */
export class SeedBlogContent1787754605505 implements MigrationInterface {
  private readonly authors = [
    { slug: 'paul', name: 'Paul' },
    { slug: 'johan', name: 'Johan' },
  ];

  private readonly tags = [
    { slug: 'strength', name: 'Strength' },
    { slug: 'recovery', name: 'Recovery' },
    { slug: 'nutrition', name: 'Nutrition' },
  ];

  private readonly posts: {
    slug: string;
    title: string;
    description: string;
    publishedAt: string;
    authorSlugs: string[];
    tagSlugs: string[];
    body: OutputData;
  }[] = [
    {
      slug: 'why-lifting-after-forty-is-different',
      title: 'Why lifting after forty is different',
      description:
        'What actually changes in your forties, and what to do about it.',
      publishedAt: '2026-08-01T09:00:00Z',
      authorSlugs: ['paul'],
      tagSlugs: ['strength', 'recovery'],
      body: {
        blocks: [
          {
            type: 'paragraph',
            data: {
              text: 'The advice you followed at twenty-five still works. It just costs more, and the bill arrives later.',
            },
          },
          {
            type: 'header',
            data: { text: 'Recovery is the constraint', level: 2 },
          },
          {
            type: 'paragraph',
            data: {
              text: 'Training capacity is rarely the limit after forty. <b>Recovery</b> is. The same session that used to need a day now needs two, and ignoring that is how a good year turns into a lost quarter.',
            },
          },
          {
            type: 'list',
            data: {
              style: 'unordered',
              items: [
                'Sleep is training. Treat a bad week of sleep as a deload.',
                'Two hard sessions a week beats four mediocre ones.',
                'Soreness is not a scoreboard.',
              ],
            },
          },
          { type: 'header', data: { text: 'Load, then patience', level: 2 } },
          {
            type: 'paragraph',
            data: {
              text: 'Progressive overload still applies. The progression is simply slower, and the people who keep making it are the ones who stopped needing every session to feel like an achievement.',
            },
          },
          {
            type: 'quote',
            data: {
              text: 'The best programme is the one you are still running in a year.',
              caption: 'Every coach, eventually',
            },
          },
        ],
      },
    },
    {
      slug: 'protein-without-the-spreadsheet',
      title: 'Protein without the spreadsheet',
      description:
        'A simple way to hit enough protein without tracking every meal.',
      publishedAt: '2026-08-14T09:00:00Z',
      authorSlugs: ['johan'],
      tagSlugs: ['nutrition'],
      body: {
        blocks: [
          {
            type: 'paragraph',
            data: {
              text: 'Most people over forty who lift are not eating enough protein. Most of them also will not track their food for more than a fortnight.',
            },
          },
          { type: 'header', data: { text: 'The rule of hand', level: 2 } },
          {
            type: 'paragraph',
            data: {
              text: 'A palm-sized portion of a protein source at each of three meals gets most people close enough. It is not precise. It is repeatable, which matters more.',
            },
          },
          {
            type: 'list',
            data: {
              style: 'ordered',
              items: [
                'One palm at breakfast — the meal most people skip protein at.',
                'One palm at lunch.',
                'One or two at dinner, depending on the day.',
              ],
            },
          },
          {
            type: 'paragraph',
            data: {
              text: 'If you want a number, aim for roughly 1.6g per kilogram of bodyweight. If that number makes you want to stop reading, use the hands.',
            },
          },
        ],
      },
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const author of this.authors) {
      await queryRunner.query(
        `INSERT INTO "blog"."authors" ("slug", "name") VALUES ($1, $2)`,
        [author.slug, author.name],
      );
    }

    for (const tag of this.tags) {
      await queryRunner.query(
        `INSERT INTO "blog"."tags" ("slug", "name") VALUES ($1, $2)`,
        [tag.slug, tag.name],
      );
    }

    for (const post of this.posts) {
      const body = sanitiseBody(post.body);

      const [row] = await queryRunner.query(
        `INSERT INTO "blog"."posts"
           ("slug", "title", "description", "body", "body_schema_version",
            "status", "published_at", "reading_time_minutes", "hero_media_id")
         VALUES ($1, $2, $3, $4, 1, 'published', $5, $6, NULL)
         RETURNING "id"`,
        [
          post.slug,
          post.title,
          post.description,
          JSON.stringify(body),
          new Date(post.publishedAt),
          readingTimeMinutes(body),
        ],
      );

      // Joined by slug rather than by an id tracked in JS, so the insert and
      // the lookup cannot disagree. The row counts are checked because
      // `WHERE slug = ANY(...)` quietly matches fewer rows than asked for,
      // which would seed a post with a missing byline and no error.
      await this.link(
        queryRunner,
        'post_authors',
        'author_id',
        'authors',
        row.id,
        post.authorSlugs,
      );
      await this.link(
        queryRunner,
        'post_tags',
        'tag_id',
        'tags',
        row.id,
        post.tagSlugs,
      );
    }
  }

  private async link(
    queryRunner: QueryRunner,
    joinTable: string,
    joinColumn: string,
    target: string,
    postId: string,
    slugs: string[],
  ): Promise<void> {
    const inserted = await queryRunner.query(
      `INSERT INTO "blog"."${joinTable}" ("post_id", "${joinColumn}")
       SELECT $1, "id" FROM "blog"."${target}" WHERE "slug" = ANY($2)
       RETURNING "post_id"`,
      [postId, slugs],
    );
    if (inserted.length !== slugs.length) {
      throw new Error(
        `Seed post ${postId} referenced ${slugs.length} ${target} ` +
          `(${slugs.join(', ')}) but matched ${inserted.length}.`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const slugs = this.posts.map((p) => p.slug);
    await queryRunner.query(
      `DELETE FROM "blog"."posts" WHERE "slug" = ANY($1)`,
      [slugs],
    );
    await queryRunner.query(
      `DELETE FROM "blog"."tags" WHERE "slug" = ANY($1)`,
      [this.tags.map((t) => t.slug)],
    );
    await queryRunner.query(
      `DELETE FROM "blog"."authors" WHERE "slug" = ANY($1)`,
      [this.authors.map((a) => a.slug)],
    );
  }
}
