import type { OutputData } from './editorjs';
import type { ImageRef, Iso8601, TagRef } from './refs';

/**
 * The authoring view of a post, which is deliberately not {@link Post}.
 *
 * `Post` is what a reader gets: always published, body already shaped for the
 * renderer, no identifiers. The editor needs the opposite — drafts, the row id,
 * the raw `OutputData` it has to load back into Editor.js, and the state of the
 * publish workflow. Sharing one type would mean the public API leaking a status
 * field that is only ever `'published'`, and the editor guessing at ids.
 */
export type PostStatus = 'draft' | 'published';

export interface AdminPostSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: PostStatus;
  /** Null only while a post has never been published. */
  publishedAt: Iso8601 | null;
  /**
   * Published with a date still in the future.
   *
   * Derived rather than stored — it is `status === 'published' && publishedAt >
   * now` — but derived once on the server so the UI does not re-derive it in a
   * different timezone and disagree with the read query.
   */
  scheduled: boolean;
  readingTimeMinutes: number;
  tags: TagRef[];
  updatedAt: Iso8601;
}

export interface AdminPostHero extends ImageRef {
  /** The `blog.media` row, which is what a write refers to. */
  mediaId: string;
}

export interface AdminPost extends AdminPostSummary {
  /** Raw, as stored: this goes straight back into Editor.js. */
  body: OutputData;
  hero: AdminPostHero | null;
}

/**
 * What the editor sends. Everything is replaced wholesale on each save —
 * there is one author editing one post, so a partial-update protocol would add
 * conflict semantics nobody needs.
 */
export interface PostDraftInput {
  title: string;
  /** Derived from the title when omitted or blank. */
  slug?: string;
  description: string;
  /** Unvalidated Editor.js output; the server sanitises it. */
  body: unknown;
  /** Free-text names. The server slugifies and upserts them. */
  tags?: string[];
  /** A `blog.media` id, or null to clear the hero. */
  heroMediaId?: string | null;
  /** Alt text for the hero, written onto the media row. Required to publish. */
  heroAlt?: string;
}

/**
 * Publishing and scheduling are the same operation with a different date, per
 * §5: a future `publishedAt` on a published row is a scheduled post, because
 * every read filters on `published_at <= now()`.
 */
export interface PublishInput {
  /** Omitted means now. A future instant schedules. */
  publishedAt?: Iso8601;
}
