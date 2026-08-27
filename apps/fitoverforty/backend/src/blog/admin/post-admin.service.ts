import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { slugify } from '@fitoverforty/content-model';
import type { AdminPost, AdminPostSummary } from '@fitoverforty/content-model';
import type { AuthenticatedUser } from '../../auth';
import { InvalidBlockError, readingTimeMinutes, sanitiseBody } from '../content';
import {
  AuthorEntity,
  CURRENT_BODY_SCHEMA_VERSION,
  MediaEntity,
  PostEntity,
  TagEntity,
} from '../entities';
import { toAdminPost, toAdminPostSummary } from './admin-post.mapper';
import type { ParsedDraft } from './post-write.request';

/** Everything the editor needs back, in one shape, for every write. */
const EDIT_RELATIONS = { tags: true, hero: true, authors: true } as const;

@Injectable()
export class PostAdminService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly posts: Repository<PostEntity>,
    @InjectRepository(TagEntity)
    private readonly tags: Repository<TagEntity>,
    @InjectRepository(AuthorEntity)
    private readonly authors: Repository<AuthorEntity>,
    @InjectRepository(MediaEntity)
    private readonly media: Repository<MediaEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Every post, drafts included.
   *
   * Deliberately not `ContentSource.listPosts`: that one filters to published
   * content and must keep doing so. The whole reason this service exists
   * separately is that an admin list which accidentally inherited that filter
   * would hide exactly the posts an author came to find.
   */
  async list(): Promise<AdminPostSummary[]> {
    const rows = await this.posts.find({
      relations: { tags: true },
      // Most-recently-touched first: the post you were just editing is the one
      // you want next, which is not the same as the most recently published.
      order: { updatedAt: 'DESC' },
    });
    const now = new Date();
    return rows.map((row) => toAdminPostSummary(row, now));
  }

  async load(id: string): Promise<AdminPost> {
    return toAdminPost(await this.require(id));
  }

  async create(
    input: ParsedDraft,
    user: AuthenticatedUser,
  ): Promise<AdminPost> {
    await this.assertSlugFree(input.slug);

    const body = this.sanitise(input.body);
    const author = await this.authorFor(user);

    const post = this.posts.create({
      slug: input.slug,
      title: input.title,
      description: input.description,
      body,
      bodySchemaVersion: CURRENT_BODY_SCHEMA_VERSION,
      status: 'draft',
      publishedAt: null,
      readingTimeMinutes: readingTimeMinutes(body),
      hero: await this.heroFor(input),
      tags: await this.upsertTags(input.tags),
      authors: [author],
    });

    return toAdminPost(await this.posts.save(post));
  }

  async update(id: string, input: ParsedDraft): Promise<AdminPost> {
    const post = await this.require(id);
    if (input.slug !== post.slug) await this.assertSlugFree(input.slug, id);

    const body = this.sanitise(input.body);

    post.slug = input.slug;
    post.title = input.title;
    post.description = input.description;
    post.body = body;
    post.bodySchemaVersion = CURRENT_BODY_SCHEMA_VERSION;
    post.readingTimeMinutes = readingTimeMinutes(body);
    post.hero = await this.heroFor(input);
    post.tags = await this.upsertTags(input.tags);
    // Authors are not touched. Attribution is set once, when the post is
    // created; a second person fixing a typo does not become a co-author.

    return toAdminPost(await this.posts.save(post));
  }

  /**
   * Publishes, or schedules — the same write with a different date.
   *
   * The alt-text check lives here rather than on the draft save on purpose. An
   * author should be able to park a half-finished post with an image and no
   * alt text yet; what must not happen is that post reaching readers that way.
   * Publishing is the last moment where refusing is still cheap.
   */
  async publish(id: string, publishedAt: Date): Promise<AdminPost> {
    const post = await this.require(id);

    if (post.hero && post.hero.alt.trim() === '') {
      throw new BadRequestException(
        'The hero image needs alt text before this post can be published. ' +
          'Describe what the image shows for readers who cannot see it.',
      );
    }

    post.status = 'published';
    post.publishedAt = publishedAt;
    return toAdminPost(await this.posts.save(post));
  }

  /**
   * Back to draft, keeping `published_at`.
   *
   * `ck_posts_published_at` allows a draft to hold a date, and keeping it means
   * republishing after a correction restores the original publication date
   * rather than silently re-dating the post to today. The read queries filter
   * on status as well, so a retained date is invisible.
   */
  async unpublish(id: string): Promise<AdminPost> {
    const post = await this.require(id);
    post.status = 'draft';
    return toAdminPost(await this.posts.save(post));
  }

  private async require(id: string): Promise<PostEntity> {
    const post = await this.posts.findOne({
      where: { id },
      relations: EDIT_RELATIONS,
    });
    if (!post) throw new NotFoundException(`No post with id "${id}".`);
    return post;
  }

  private sanitise(body: unknown) {
    try {
      return sanitiseBody(body);
    } catch (error) {
      if (error instanceof InvalidBlockError) {
        // The author is looking at the block that caused this, so the index and
        // the reason are worth the round trip.
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async assertSlugFree(slug: string, exceptId?: string): Promise<void> {
    const clash = await this.posts.findOne({
      where: exceptId ? { slug, id: Not(exceptId) } : { slug },
      select: { id: true },
    });
    if (clash) {
      // Not auto-suffixed. A slug is a URL somebody may already have shared,
      // so quietly turning it into "-2" is worse than saying it is taken.
      throw new ConflictException(
        `Another post already uses the slug "${slug}".`,
      );
    }
  }

  /**
   * Resolves the hero, and writes the alt text onto the media row.
   *
   * Alt lives on `blog.media` rather than on the post because it describes the
   * image, not this use of it. Uploading writes it empty; this is where it
   * gets filled in.
   */
  private async heroFor(input: ParsedDraft): Promise<MediaEntity | null> {
    if (!input.heroMediaId) return null;

    const media = await this.media.findOne({
      where: { id: input.heroMediaId },
    });
    if (!media) {
      throw new BadRequestException(
        `No uploaded image with id "${input.heroMediaId}".`,
      );
    }

    if (input.heroAlt !== undefined && input.heroAlt.trim() !== media.alt) {
      media.alt = input.heroAlt.trim();
      await this.media.save(media);
    }
    return media;
  }

  /**
   * Finds or creates every tag, then returns the rows to attach.
   *
   * `orIgnore` rather than a read-then-write: two saves racing on the same new
   * tag would otherwise hit the unique index, and losing a whole save because
   * somebody else typed the same tag first is a poor trade.
   */
  private async upsertTags(
    tags: { slug: string; name: string }[],
  ): Promise<TagEntity[]> {
    if (tags.length === 0) return [];

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(TagEntity)
      .values(tags)
      .orIgnore()
      .execute();

    return this.tags.find({ where: { slug: In(tags.map((t) => t.slug)) } });
  }

  /**
   * The author row this account writes as, created on first use.
   *
   * Auto-provisioned rather than requiring a separate step: there are two
   * accounts and both of them write, so making somebody create an author row
   * by hand before their first post would be ceremony with no decision in it.
   */
  private async authorFor(user: AuthenticatedUser): Promise<AuthorEntity> {
    const existing = await this.authors.findOne({
      where: { userId: user.id },
    });
    if (existing) return existing;

    const name = user.name?.trim() || user.email;
    return this.authors.save(
      this.authors.create({
        userId: user.id,
        name,
        slug: await this.freeAuthorSlug(name),
      }),
    );
  }

  /** `ck_authors_slug_kebab` and `uq_authors_slug` both have to hold. */
  private async freeAuthorSlug(name: string): Promise<string> {
    const base = slugify(name) || 'author';
    for (let suffix = 0; suffix < 100; suffix++) {
      const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
      const taken = await this.authors.findOne({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    // Two people can share a name; a hundred cannot, and looping forever to
    // find out would be worse than saying so.
    throw new ConflictException(
      `Could not find a free author slug based on "${base}".`,
    );
  }
}
