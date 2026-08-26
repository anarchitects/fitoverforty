import type { OutputData } from './editorjs';
import type { AuthorRef, ImageRef, Iso8601, TagRef } from './refs';

export interface Heading {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface PostSummary {
  slug: string;
  title: string;
  /** <= 160 characters. Drives the meta description, cards and the feed. */
  description: string;
  publishedAt: Iso8601;
  updatedAt?: Iso8601;
  authors: AuthorRef[];
  tags: TagRef[];
  hero?: ImageRef;
  readingTimeMinutes: number;
}

/**
 * Discriminated so the rendering layer never learns where a post came from.
 *
 * `blocks` is what the editor produces and the only kind written today.
 * `html` exists for imported or legacy content and must already be sanitised
 * by the time it reaches this type.
 */
export type PostBody =
  | { kind: 'blocks'; blocks: OutputData }
  | { kind: 'html'; html: string };

export interface Post extends PostSummary {
  body: PostBody;
  headings: Heading[];
}

export function isBlocksBody(
  body: PostBody,
): body is Extract<PostBody, { kind: 'blocks' }> {
  return body.kind === 'blocks';
}

export function isHtmlBody(
  body: PostBody,
): body is Extract<PostBody, { kind: 'html' }> {
  return body.kind === 'html';
}
