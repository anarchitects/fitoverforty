import { MigrationInterface, QueryRunner } from 'typeorm';
import type { OutputData } from '@fitoverforty/content-model';
import { readingTimeMinutes, sanitiseBody } from '../../../src/blog/content';
import {
  AuthorEntity,
  CURRENT_BODY_SCHEMA_VERSION,
  PostEntity,
  TagEntity,
} from '../../../src/blog/entities';

/**
 * Phase A content, seeded the same way the contact form config is.
 *
 * This is a stopgap: Phase B replaces it with an authoring UI writing to these
 * same tables, so nothing here is thrown away when that lands.
 *
 * Bodies go through sanitiseBody deliberately — seeded content should not be
 * able to contain anything an author could not have published through the API.
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
    const manager = queryRunner.manager;

    const authorBySlug = new Map<string, AuthorEntity>();
    for (const author of this.authors) {
      authorBySlug.set(
        author.slug,
        await manager
          .getRepository(AuthorEntity)
          .save(
            manager
              .getRepository(AuthorEntity)
              .create({ ...author, avatar: null }),
          ),
      );
    }

    const tagBySlug = new Map<string, TagEntity>();
    for (const tag of this.tags) {
      tagBySlug.set(
        tag.slug,
        await manager
          .getRepository(TagEntity)
          .save(manager.getRepository(TagEntity).create(tag)),
      );
    }

    for (const post of this.posts) {
      const body = sanitiseBody(post.body);
      await manager.getRepository(PostEntity).save(
        manager.getRepository(PostEntity).create({
          slug: post.slug,
          title: post.title,
          description: post.description,
          body,
          bodySchemaVersion: CURRENT_BODY_SCHEMA_VERSION,
          status: 'published',
          publishedAt: new Date(post.publishedAt),
          readingTimeMinutes: readingTimeMinutes(body),
          hero: null,
          authors: post.authorSlugs.map((slug) => {
            const author = authorBySlug.get(slug);
            if (!author) throw new Error(`Unknown seed author "${slug}"`);
            return author;
          }),
          tags: post.tagSlugs.map((slug) => {
            const tag = tagBySlug.get(slug);
            if (!tag) throw new Error(`Unknown seed tag "${slug}"`);
            return tag;
          }),
        }),
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
