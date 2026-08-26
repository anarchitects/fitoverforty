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
