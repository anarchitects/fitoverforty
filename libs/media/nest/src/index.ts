/**
 * Uploads and serving. The rows live in `blog.media` and `MediaEntity` belongs
 * to `@fitoverforty/blog-nest`: the table sits in the blog schema, and both
 * `PostEntity.hero` and `AuthorEntity.avatar` hold relations to it. This domain
 * owns the *storage* of an image, not the row that describes it, so the
 * dependency points this way rather than the other.
 */
export { MediaModule } from './lib/media.module';
export { MediaService } from './lib/media.service';
export { MEDIA_STORAGE } from './lib/media-storage.port';
export type { MediaStoragePort, StoredMedia } from './lib/media-storage.port';
export {
  MAX_UPLOAD_BYTES,
  RejectedUploadError,
  inspectImage,
} from './lib/image-rules';
