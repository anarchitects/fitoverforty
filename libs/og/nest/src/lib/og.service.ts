import { Inject, Injectable } from '@nestjs/common';
import type { ContentSource } from '@fitoverforty/blog-ts';
import { CONTENT_SOURCE } from '@fitoverforty/blog-nest';
import { OgRenderer } from './og-renderer';
import type { CardInput } from './og-card';

/**
 * How many rendered cards to keep.
 *
 * Rendering one takes tens of milliseconds and the bytes are a few kilobytes,
 * so this is a cheap way to absorb the burst a crawler produces when a post is
 * shared — the same URL is typically fetched by several scrapers at once. It
 * is deliberately small: a blog has far fewer live posts than this, and an
 * unbounded map in a long-running process is a leak with a slow fuse.
 */
const MAX_ENTRIES = 64;

export const SITE_CARD: CardInput = {
  title: 'Fit Over Forty',
  description:
    'Training, recovery and nutrition for people who did not start yesterday.',
};

@Injectable()
export class OgService {
  private readonly cache = new Map<string, Buffer>();

  constructor(
    private readonly renderer: OgRenderer,
    @Inject(CONTENT_SOURCE) private readonly content: ContentSource,
  ) {}

  /**
   * The card for a published post, or undefined if there is no such post.
   *
   * Undefined rather than a generic card: a 404 here is the honest answer, and
   * serving a placeholder would let a mistyped slug sit in someone's timeline
   * looking deliberate.
   */
  async forPost(slug: string, kicker: string): Promise<Buffer | undefined> {
    const post = await this.content.loadPost(slug);
    if (!post) return undefined;

    /**
     * Keyed by the timestamp as well as the slug, so editing a post produces a
     * different entry rather than serving the old card until the process
     * restarts. The stale entry falls out of the map on its own.
     */
    return this.render(`post:${slug}:${post.updatedAt}`, {
      title: post.title,
      description: post.description,
      pillar: post.pillar?.name,
      kicker,
    });
  }

  /** The card for anything that is not a single post. */
  async forSite(kicker: string): Promise<Buffer> {
    return this.render('site', { ...SITE_CARD, kicker });
  }

  private async render(key: string, input: CardInput): Promise<Buffer> {
    const hit = this.cache.get(key);
    if (hit) return hit;

    const png = await this.renderer.render(input);

    // Oldest first: Map iterates in insertion order.
    if (this.cache.size >= MAX_ENTRIES) {
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.cache.delete(oldest.value);
    }
    this.cache.set(key, png);

    return png;
  }
}
