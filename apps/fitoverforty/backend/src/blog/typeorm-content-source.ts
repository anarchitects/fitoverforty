import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import type {
  ContentSource,
  Paged,
  Post,
  PostSummary,
  TagRef,
} from '@fitoverforty/content-model';
import { PostEntity, TagEntity } from './entities';
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
    @InjectRepository(TagEntity)
    private readonly tags: Repository<TagEntity>,
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

  async listTags(): Promise<TagRef[]> {
    // Only tags that actually have a visible post. An empty tag archive is a
    // dead end for readers and a crawl target for nothing.
    //
    // EXISTS rather than a join: the join would return one row per matching
    // post and need de-duplicating, and we only care whether any exists.
    const tags = await this.tags
      .createQueryBuilder('tag')
      .where((qb) => {
        const sub = qb
          .subQuery()
          .select('1')
          .from(PostEntity, 'post')
          .innerJoin('post.tags', 'posttag')
          .where('posttag.id = tag.id')
          .andWhere('post.status = :status')
          .andWhere('post.published_at <= now()')
          .getQuery();
        return `EXISTS ${sub}`;
      })
      .setParameter('status', 'published')
      .orderBy('tag.name', 'ASC')
      .getMany();

    return tags.map((tag) => ({ slug: tag.slug, name: tag.name }));
  }
}
