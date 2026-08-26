import type { Paged } from './paged';
import type { Post, PostSummary } from './post';
import type { TagRef } from './refs';

/**
 * The narrow contract between stored content and everything that renders it.
 *
 * Async throughout because the source is a database. An implementation must
 * only ever return published content — draft and future-dated filtering is the
 * source's job, not the caller's.
 */
export interface ContentSource {
  listPosts(page: number, perPage: number): Promise<Paged<PostSummary>>;
  listTags(): Promise<TagRef[]>;
  postsByTag(
    tagSlug: string,
    page: number,
    perPage: number,
  ): Promise<Paged<PostSummary>>;
  loadPost(slug: string): Promise<Post | undefined>;
}
