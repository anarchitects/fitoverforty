import type { Paged } from './paged';
import type { Post, PostRef, PostSummary } from './post';
import type { AuthorProfile, PillarSummary, TagSummary } from './refs';

/**
 * The narrow contract between stored content and everything that renders it.
 *
 * Async throughout because the source is a database. An implementation must
 * only ever return published content — draft and future-dated filtering is the
 * source's job, not the caller's.
 */
export interface ContentSource {
  listPosts(page: number, perPage: number): Promise<Paged<PostSummary>>;
  listTags(): Promise<TagSummary[]>;
  postsByTag(
    tagSlug: string,
    page: number,
    perPage: number,
  ): Promise<Paged<PostSummary>>;
  listPillars(): Promise<PillarSummary[]>;
  postsByPillar(
    pillarSlug: string,
    page: number,
    perPage: number,
  ): Promise<Paged<PostSummary>>;
  loadPost(slug: string): Promise<Post | undefined>;

  /**
   * Other posts a reader of this one might want, newest first.
   *
   * Same pillar before anything else, because a pillar is the section a post
   * is filed under and is the strongest signal of relatedness the content
   * model carries. Topped up with recent posts when the pillar cannot fill
   * the list, so a new pillar with one post in it still offers a way onward
   * rather than showing nothing.
   *
   * Never includes the post it was asked about.
   */
  relatedPosts(slug: string, limit: number): Promise<PostSummary[]>;

  /**
   * One author, or undefined when no such author exists.
   *
   * An author with no published posts is still an author: they may be
   * credited only on something scheduled, or on a post since unpublished. The
   * page says so rather than 404ing, because the slug is linked from every
   * byline and a dead link there is worse than an empty page.
   */
  loadAuthor(slug: string): Promise<AuthorProfile | undefined>;

  postsByAuthor(
    authorSlug: string,
    page: number,
    perPage: number,
  ): Promise<Paged<PostSummary>>;

  /** Every published post, unpaginated. For the sitemap. */
  listPublishedRefs(): Promise<PostRef[]>;
}
