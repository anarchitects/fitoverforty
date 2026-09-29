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

/**
 * An author plus what their own page needs: the prose, and how much they have
 * written. Widens AuthorRef rather than replacing it — a byline on a post
 * carries neither, and making every AuthorRef carry them would mean loading a
 * bio to render a listing.
 */
export interface AuthorProfile extends AuthorRef {
  bio?: string;
  postCount: number;
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

export interface PillarRef {
  /** kebab-case, and one of PILLAR_SLUGS. */
  slug: string;
  name: string;
}

/**
 * A pillar plus how many published posts sit in it.
 *
 * Mirrors TagSummary for the same reason: a post's own pillar does not need a
 * count, and only the pillar index does.
 */
export interface PillarSummary extends PillarRef {
  postCount: number;
  /** Fixed display order, so the four always read Physical → Financial. */
  position: number;
}
