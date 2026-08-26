/** An ISO 8601 instant or date, depending on the field. */
export type Iso8601 = string;

export interface ImageRef {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface AuthorRef {
  id: string;
  /** Stable, URL-safe. Used for a future /blog/author/:slug route. */
  slug: string;
  name: string;
  avatar?: ImageRef;
}

export interface TagRef {
  /** kebab-case. */
  slug: string;
  name: string;
}

/**
 * A tag plus how many published posts carry it.
 *
 * Widens TagRef rather than replacing it: a post's own tags do not need a
 * count, and making every TagRef carry one would mean computing it everywhere.
 */
export interface TagSummary extends TagRef {
  postCount: number;
}
