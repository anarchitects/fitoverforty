/**
 * Somewhere to put bytes, and a way to address them afterwards.
 *
 * A port rather than a concrete store because the target is a deployment
 * choice, not an application one (spec §9, community epic #72): local disk in
 * development, object storage in production, swapped by configuration rather
 * than by editing the upload path. Nothing above this interface knows which is
 * in use.
 *
 * Deliberately narrow. Listing, signed URLs and deletion are all things an
 * object store does well and a disk does badly, and none of them are needed
 * yet — adding them now would mean designing them against a guess.
 */
export interface StoredMedia {
  /** Opaque handle for the stored object, as written to `blog.media`. */
  key: string;
  /** Where a browser can fetch it. Site-relative for the local adapter. */
  url: string;
}

export interface MediaStoragePort {
  put(key: string, bytes: Buffer, mime: string): Promise<StoredMedia>;
  /**
   * Reads an object back.
   *
   * Returns null rather than throwing for a missing key: a request for an
   * object that is not there is a 404, not an error, and making the caller
   * catch to discover that would invert the normal case.
   */
  get(key: string): Promise<Buffer | null>;
}

export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');
