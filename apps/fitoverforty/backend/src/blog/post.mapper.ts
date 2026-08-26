import type {
  AuthorRef,
  ImageRef,
  Post,
  PostSummary,
  TagRef,
} from '@fitoverforty/content-model';
import { extractHeadings } from './content';
import type {
  AuthorEntity,
  MediaEntity,
  PostEntity,
  TagEntity,
} from './entities';

function toImageRef(media: MediaEntity): ImageRef {
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
