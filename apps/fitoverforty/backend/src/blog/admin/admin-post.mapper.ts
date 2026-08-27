import type {
  AdminPost,
  AdminPostSummary,
} from '@fitoverforty/content-model';
import type { PostEntity } from '../entities';

/**
 * True when a published post's date has not arrived yet.
 *
 * Computed here, once, from the same clock the read query uses. If the browser
 * derived it instead, a client in another timezone with a skewed clock could
 * show "live" for a post the archive still hides.
 */
function isScheduled(post: PostEntity, now: Date): boolean {
  return (
    post.status === 'published' &&
    post.publishedAt !== null &&
    post.publishedAt.getTime() > now.getTime()
  );
}

export function toAdminPostSummary(
  post: PostEntity,
  now = new Date(),
): AdminPostSummary {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    description: post.description,
    status: post.status,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    scheduled: isScheduled(post, now),
    readingTimeMinutes: post.readingTimeMinutes,
    tags: (post.tags ?? []).map((tag) => ({ slug: tag.slug, name: tag.name })),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export function toAdminPost(post: PostEntity, now = new Date()): AdminPost {
  return {
    ...toAdminPostSummary(post, now),
    // Straight out of the column. The editor has to receive exactly what was
    // stored, or reopening a post would rewrite it on the next save.
    body: post.body,
    hero: post.hero
      ? {
          mediaId: post.hero.id,
          src: post.hero.url,
          alt: post.hero.alt,
          width: post.hero.width,
          height: post.hero.height,
        }
      : null,
  };
}
