import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import type {
  ContentSource,
  Paged,
  Post,
  PostRef,
  PostSummary,
  TagSummary,
} from '@fitoverforty/content-model';
import { PostEntity } from './entities';
import { toPost, toPostSummary } from './post.mapper';

const POST_RELATIONS = {
  tags: true,
  hero: true,
  authors: { avatar: true },
} as const;

@Injectable()
export class TypeOrmContentSource implements ContentSource {
  constructor(
    @InjectRepository(PostEntity)
    private readonly posts: Repository<PostEntity>,
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

  async loadPost(slug: string): Promise<Post | undefined> {
    const post = await this.posts.findOne({
      where: { ...this.publishedWhere(), slug },
      relations: POST_RELATIONS,
    });
    return post ? toPost(post) : undefined;
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
