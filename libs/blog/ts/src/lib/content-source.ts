import type { Paged } from './paged';
import type { Post, PostRef, PostSummary } from './post';
import type { PillarSummary, TagSummary } from './refs';

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

  /** Every published post, unpaginated. For the sitemap. */
  listPublishedRefs(): Promise<PostRef[]>;
}
