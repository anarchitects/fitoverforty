import type {
  AuthorRef,
  ImageRef,
  PillarRef,
  Post,
  PostSummary,
  TagRef,
} from '@fitoverforty/blog-ts';
import { extractHeadings } from './content';
import type {
  AuthorEntity,
  MediaEntity,
  PillarEntity,
  PostEntity,
  TagEntity,
} from './entities';

export function toImageRef(media: MediaEntity): ImageRef {
  return {
    src: media.url,
    alt: media.alt,
    width: media.width,
    height: media.height,
  };
}

function toAuthorRef(author: AuthorEntity): AuthorRef {
  return {
    id: author.id,
    slug: author.slug,
    name: author.name,
    ...(author.avatar ? { avatar: toImageRef(author.avatar) } : {}),
  };
}

function toTagRef(tag: TagEntity): TagRef {
  return { slug: tag.slug, name: tag.name };
}

function toPillarRef(pillar: PillarEntity): PillarRef {
  return { slug: pillar.slug, name: pillar.name };
}

export function toPostSummary(post: PostEntity): PostSummary {
  return {
    slug: post.slug,
    title: post.title,
    description: post.description,
    // Non-null by construction: ck_posts_published_at guarantees a published
    // post has a date, and the source only ever returns published posts.
    publishedAt: (post.publishedAt as Date).toISOString(),
    updatedAt: post.updatedAt?.toISOString(),
    authors: (post.authors ?? []).map(toAuthorRef),
    // Spread rather than `pillar: null`: the contract says optional, and a
    // published post always has one. Absent means an unfiled draft.
    ...(post.pillar ? { pillar: toPillarRef(post.pillar) } : {}),
    tags: (post.tags ?? []).map(toTagRef),
    ...(post.hero ? { hero: toImageRef(post.hero) } : {}),
    readingTimeMinutes: post.readingTimeMinutes,
  };
}

export function toPost(post: PostEntity): Post {
  return {
    ...toPostSummary(post),
    body: { kind: 'blocks', blocks: post.body },
    // Derived on read rather than stored: it is one pass over a single post's
    // blocks, and storing it would mean a migration every time slugging changes.
    headings: extractHeadings(post.body),
  };
}
