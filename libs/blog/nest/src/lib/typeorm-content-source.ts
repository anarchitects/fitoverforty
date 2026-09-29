import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Not, Repository } from 'typeorm';
import type {
  AuthorProfile,
  ContentSource,
  Paged,
  PillarSummary,
  Post,
  PostRef,
  PostSummary,
  TagSummary,
} from '@fitoverforty/blog-ts';
import { AuthorEntity, PillarEntity, PostEntity } from './entities';
import { toImageRef, toPost, toPostSummary } from './post.mapper';

const POST_RELATIONS = {
  tags: true,
  pillar: true,
  hero: true,
  authors: { avatar: true },
} as const;

@Injectable()
export class TypeOrmContentSource implements ContentSource {
  constructor(
    @InjectRepository(PostEntity)
    private readonly posts: Repository<PostEntity>,
    @InjectRepository(PillarEntity)
    private readonly pillars: Repository<PillarEntity>,
    @InjectRepository(AuthorEntity)
    private readonly authors: Repository<AuthorEntity>,
  ) {}

  /**
   * Published *and* not future-dated. Every read goes through this: filtering
   * drafts is the source's job, so no caller can forget it.
   */
  private publishedWhere() {
    return {
      status: 'published' as const,
      publishedAt: LessThanOrEqual(new Date()),
    };
  }

  private paged<T>(
    items: T[],
    total: number,
    page: number,
    perPage: number,
  ): Paged<T> {
    return {
      items,
      page,
      perPage,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    };
  }

  async listPosts(page: number, perPage: number): Promise<Paged<PostSummary>> {
    const [rows, total] = await this.posts.findAndCount({
      where: this.publishedWhere(),
      relations: POST_RELATIONS,
      order: { publishedAt: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return this.paged(rows.map(toPostSummary), total, page, perPage);
  }

  async postsByTag(
    tagSlug: string,
    page: number,
    perPage: number,
  ): Promise<Paged<PostSummary>> {
    // Two steps on purpose: filtering by a joined relation and paginating in
    // one query returns the wrong count, because the join multiplies rows.
    const matching = await this.posts
      .createQueryBuilder('post')
      .select('post.id', 'id')
      .innerJoin('post.tags', 'tag')
      .where('tag.slug = :tagSlug', { tagSlug })
      .andWhere('post.status = :status', { status: 'published' })
      .andWhere('post.published_at <= now()')
      .orderBy('post.published_at', 'DESC')
      .getRawMany<{ id: string }>();

    const total = matching.length;
    const ids = matching
      .slice((page - 1) * perPage, page * perPage)
      .map((r) => r.id);
    if (ids.length === 0)
      return this.paged<PostSummary>([], total, page, perPage);

    const rows = await this.posts.find({
      where: ids.map((id) => ({ id })),
      relations: POST_RELATIONS,
      order: { publishedAt: 'DESC' },
    });
    return this.paged(rows.map(toPostSummary), total, page, perPage);
  }

  async postsByPillar(
    pillarSlug: string,
    page: number,
    perPage: number,
  ): Promise<Paged<PostSummary>> {
    // Unlike postsByTag this can filter and paginate in one query: a post has
    // at most one pillar, so the join cannot multiply rows and the count stays
    // honest.
    const [rows, total] = await this.posts.findAndCount({
      where: { ...this.publishedWhere(), pillar: { slug: pillarSlug } },
      relations: POST_RELATIONS,
      order: { publishedAt: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return this.paged(rows.map(toPostSummary), total, page, perPage);
  }

  async loadPost(slug: string): Promise<Post | undefined> {
    const post = await this.posts.findOne({
      where: { ...this.publishedWhere(), slug },
      relations: POST_RELATIONS,
    });
    return post ? toPost(post) : undefined;
  }

  async loadAuthor(slug: string): Promise<AuthorProfile | undefined> {
    const author = await this.authors.findOne({
      where: { slug },
      relations: { avatar: true },
    });
    if (!author) return undefined;

    /**
     * Counted rather than derived from a loaded list: the page paginates, so
     * the posts it renders are one page of them, and "12 posts" has to mean
     * all of them rather than however many fit on screen.
     */
    const postCount = await this.posts
      .createQueryBuilder('post')
      .innerJoin('post.authors', 'author')
      .where('author.slug = :slug', { slug })
      .andWhere('post.status = :status', { status: 'published' })
      .andWhere('post.published_at <= now()')
      .getCount();

    return {
      id: author.id,
      slug: author.slug,
      name: author.name,
      ...(author.bio ? { bio: author.bio } : {}),
      ...(author.avatar ? { avatar: toImageRef(author.avatar) } : {}),
      postCount,
    };
  }

  async postsByAuthor(
    authorSlug: string,
    page: number,
    perPage: number,
  ): Promise<Paged<PostSummary>> {
    // Two steps, for the same reason postsByTag needs them: a post has many
    // authors, so filtering and paginating in one query lets the join
    // multiply rows and the count stops being the number of posts.
    const matching = await this.posts
      .createQueryBuilder('post')
      .select('post.id', 'id')
      .innerJoin('post.authors', 'author')
      .where('author.slug = :authorSlug', { authorSlug })
      .andWhere('post.status = :status', { status: 'published' })
      .andWhere('post.published_at <= now()')
      .orderBy('post.published_at', 'DESC')
      .getRawMany<{ id: string }>();

    const total = matching.length;
    const ids = matching
      .slice((page - 1) * perPage, page * perPage)
      .map((r) => r.id);
    if (ids.length === 0)
      return this.paged<PostSummary>([], total, page, perPage);

    const rows = await this.posts.find({
      where: ids.map((id) => ({ id })),
      relations: POST_RELATIONS,
      order: { publishedAt: 'DESC' },
    });
    return this.paged(rows.map(toPostSummary), total, page, perPage);
  }

  async relatedPosts(slug: string, limit: number): Promise<PostSummary[]> {
    const post = await this.posts.findOne({
      where: { ...this.publishedWhere(), slug },
      relations: { pillar: true },
    });
    // A post that is not published has no related posts rather than the
    // recent ones: answering at all would confirm the slug exists.
    if (!post) return [];

    const samePillar = post.pillar
      ? await this.posts.find({
          where: {
            ...this.publishedWhere(),
            pillar: { slug: post.pillar.slug },
            id: Not(post.id),
          },
          relations: POST_RELATIONS,
          order: { publishedAt: 'DESC' },
          take: limit,
        })
      : [];

    if (samePillar.length >= limit) {
      return samePillar.map(toPostSummary);
    }

    /**
     * Top up with recent posts, excluding this one and anything already
     * chosen. Without this a pillar holding a single post offers a reader
     * nothing at the foot of it, which is the case this feature exists for.
     */
    const exclude = [post.id, ...samePillar.map((p) => p.id)];
    const recent = await this.posts.find({
      where: { ...this.publishedWhere(), id: Not(In(exclude)) },
      relations: POST_RELATIONS,
      order: { publishedAt: 'DESC' },
      take: limit - samePillar.length,
    });

    return [...samePillar, ...recent].map(toPostSummary);
  }

  async listPublishedRefs(): Promise<PostRef[]> {
    // No relations and no pagination: the sitemap needs every public URL, and
    // loading tags and authors for each would be pure waste.
    const rows = await this.posts.find({
      where: this.publishedWhere(),
      select: { slug: true, publishedAt: true, updatedAt: true },
      order: { publishedAt: 'DESC' },
    });

    return rows.map((row) => ({
      slug: row.slug,
      publishedAt: (row.publishedAt as Date).toISOString(),
      updatedAt: row.updatedAt?.toISOString(),
    }));
  }

  async listPillars(): Promise<PillarSummary[]> {
    // A LEFT join, unlike listTags: the four pillars are navigation, so one
    // with nothing in it yet still has to appear rather than vanish from the
    // index until someone writes for it.
    const rows = await this.pillars
      .createQueryBuilder('pillar')
      .select('pillar.slug', 'slug')
      .addSelect('pillar.name', 'name')
      .addSelect('pillar.position', 'position')
      .addSelect(
        `COUNT(post.id) FILTER (
          WHERE post.status = 'published' AND post.published_at <= now()
        )`,
        'count',
      )
      .leftJoin(PostEntity, 'post', 'post.pillar_id = pillar.id')
      .groupBy('pillar.slug')
      .addGroupBy('pillar.name')
      .addGroupBy('pillar.position')
      .orderBy('pillar.position', 'ASC')
      .getRawMany<{
        slug: string;
        name: string;
        position: number;
        count: string;
      }>();

    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      position: Number(row.position),
      // COUNT is a bigint and comes back as a string, as in listTags.
      postCount: Number.parseInt(row.count, 10),
    }));
  }

  async listTags(): Promise<TagSummary[]> {
    // Only tags with a visible post, and how many carry each. One grouped
    // query rather than a count per tag, which would make the tag index N+1.
    const rows = await this.posts
      .createQueryBuilder('post')
      .select('tag.slug', 'slug')
      .addSelect('tag.name', 'name')
      .addSelect('COUNT(post.id)', 'count')
      .innerJoin('post.tags', 'tag')
      .where('post.status = :status', { status: 'published' })
      .andWhere('post.published_at <= now()')
      .groupBy('tag.slug')
      .addGroupBy('tag.name')
      .orderBy('tag.name', 'ASC')
      .getRawMany<{ slug: string; name: string; count: string }>();

    // COUNT comes back as a string from pg: it is a bigint, which does not fit
    // a JS number in the general case.
    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      postCount: Number.parseInt(row.count, 10),
    }));
  }
}
