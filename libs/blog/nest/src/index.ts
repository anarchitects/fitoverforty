export { BlogModule } from './lib/blog.module';
export { CONTENT_SOURCE } from './lib/content-source.token';

/**
 * Entities are exported because `data-source.ts` in the app composes them into
 * the DataSource — the app owns the connection, the domain owns the shape.
 *
 * `MediaEntity` is here rather than in the media domain because `PostEntity.hero`
 * and `AuthorEntity.avatar` both reference it, so it cannot move without one of
 * the two domains depending on the other. Left as it was; worth settling when
 * the media domain moves rather than in passing.
 */
export {
  AuthorEntity,
  MediaEntity,
  PostEntity,
  PillarEntity,
  TagEntity,
  CURRENT_BODY_SCHEMA_VERSION,
} from './lib/entities';
export type { PostStatus } from './lib/entities';

/**
 * The sanitiser is exported because `SeedBlogContent` uses it: seeded content
 * must not be able to contain anything an author could not have published
 * through the API.
 */
export {
  sanitiseBody,
  sanitiseInline,
  extractHeadings,
  readingTimeMinutes,
  InvalidBlockError,
  SUPPORTED_BLOCK_TYPES,
} from './lib/content';

/**
 * Exported for `@fitoverforty/og-nest`, which needs the same public origin the
 * feed and sitemap use to label a social card with the site's hostname.
 */
export { siteOrigin } from './lib/site-url';
