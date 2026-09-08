import { BadRequestException } from '@nestjs/common';
import { isPillarSlug, PILLAR_SLUGS, slugify } from '@fitoverforty/blog-ts';
import type { PostDraftInput } from '@fitoverforty/blog-ts';

/**
 * Hand-written parsing, matching `subscribe.request.ts` rather than reaching
 * for class-validator: these are a handful of fields with rules the database
 * already states, and the value here is that the message says which field and
 * why.
 */

/** `ck_posts_description` caps this at 160, and so does every meta description. */
const MAX_DESCRIPTION = 160;
const MAX_TITLE = 200;
const MAX_SLUG = 120;
const MAX_TAGS = 8;
const MAX_TAG_NAME = 40;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function object(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Expected an object.');
  }
  return body as Record<string, unknown>;
}

function text(
  input: Record<string, unknown>,
  key: string,
  max: number,
): string {
  const value = input[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`"${key}" is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new BadRequestException(
      `"${key}" must be ${max} characters or fewer.`,
    );
  }
  return trimmed;
}

/**
 * Tag names in, kebab-case slugs out, duplicates collapsed.
 *
 * Slugified here rather than at the database boundary because two names can
 * collapse to one slug — "Strength Training" and "strength training" — and the
 * caller should get one tag rather than a unique-violation.
 */
function parseTags(value: unknown): { slug: string; name: string }[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new BadRequestException('"tags" must be an array of names.');
  }
  if (value.length > MAX_TAGS) {
    throw new BadRequestException(`A post may carry at most ${MAX_TAGS} tags.`);
  }

  const bySlug = new Map<string, { slug: string; name: string }>();
  for (const raw of value) {
    if (typeof raw !== 'string') {
      throw new BadRequestException('Every tag must be a string.');
    }
    const name = raw.trim();
    if (name === '') continue;
    if (name.length > MAX_TAG_NAME) {
      throw new BadRequestException(
        `Tag "${name}" is longer than ${MAX_TAG_NAME} characters.`,
      );
    }
    const slug = slugify(name);
    if (slug === '') {
      throw new BadRequestException(
        `Tag "${name}" has no letters or digits to make a URL from.`,
      );
    }
    // First spelling wins, so the display name is the one the author typed.
    if (!bySlug.has(slug)) bySlug.set(slug, { slug, name });
  }
  return [...bySlug.values()];
}

export interface ParsedDraft extends Omit<PostDraftInput, 'tags'> {
  slug: string;
  tags: { slug: string; name: string }[];
  heroMediaId: string | null;
  heroAlt: string | undefined;
  /** Null means "leave it unfiled", which only a draft may stay. */
  pillarSlug: string | null;
}

export function parseDraftBody(body: unknown): ParsedDraft {
  const input = object(body);

  const title = text(input, 'title', MAX_TITLE);
  const description = text(input, 'description', MAX_DESCRIPTION);

  const rawSlug = input['slug'];
  const candidate =
    typeof rawSlug === 'string' && rawSlug.trim() !== ''
      ? rawSlug.trim()
      : title;
  const slug = slugify(candidate);
  if (slug === '') {
    throw new BadRequestException(
      'The slug is empty. Give the post a title with letters or digits in it, or set a slug explicitly.',
    );
  }
  if (slug.length > MAX_SLUG) {
    throw new BadRequestException(
      `The slug must be ${MAX_SLUG} characters or fewer; "${slug}" is ${slug.length}.`,
    );
  }

  const rawHero = input['heroMediaId'];
  if (
    rawHero !== undefined &&
    rawHero !== null &&
    (typeof rawHero !== 'string' || !UUID.test(rawHero))
  ) {
    throw new BadRequestException('"heroMediaId" must be a media id or null.');
  }

  /**
   * Checked against the fixed set rather than looked up, so a typo fails here
   * with the four names in the message rather than as a foreign key violation
   * several frames later.
   */
  const rawPillar = input['pillarSlug'];
  if (
    rawPillar !== undefined &&
    rawPillar !== null &&
    (typeof rawPillar !== 'string' || !isPillarSlug(rawPillar))
  ) {
    throw new BadRequestException(
      `"pillarSlug" must be null or one of: ${PILLAR_SLUGS.join(', ')}.`,
    );
  }
  const pillarSlug = typeof rawPillar === 'string' ? rawPillar : null;

  const rawAlt = input['heroAlt'];
  if (rawAlt !== undefined && typeof rawAlt !== 'string') {
    throw new BadRequestException('"heroAlt" must be a string when present.');
  }

  return {
    title,
    slug,
    description,
    // Left as-is: `sanitiseBody` is the only thing allowed to have an opinion
    // about block content, and duplicating any of it here would be a second
    // place to keep in step.
    body: input['body'],
    tags: parseTags(input['tags']),
    pillarSlug,
    heroMediaId: (rawHero as string | null | undefined) ?? null,
    heroAlt: rawAlt as string | undefined,
  };
}

/**
 * The resolved form of {@link PublishInput}: an actual instant, never absent.
 * "Publish now" is turned into a date here so the service has one code path.
 */
export interface ParsedPublish {
  publishedAt: Date;
}

/** How far ahead a post may be scheduled. A typo of "2260" should not sit in the table. */
const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

export function parsePublishBody(
  body: unknown,
  now = new Date(),
): ParsedPublish {
  // An empty body is the common case — "publish this, now" — so no body at all
  // has to mean the same thing as `{}`.
  const input = body === undefined || body === null ? {} : object(body);

  const raw = input['publishedAt'];
  if (raw === undefined || raw === null) return { publishedAt: now };
  if (typeof raw !== 'string') {
    throw new BadRequestException('"publishedAt" must be an ISO 8601 string.');
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(
      `"publishedAt" is not a date I can read: "${raw}".`,
    );
  }
  if (parsed.getTime() - now.getTime() > MAX_SCHEDULE_AHEAD_MS) {
    throw new BadRequestException(
      'A post cannot be scheduled more than a year ahead.',
    );
  }

  // A past date is allowed and useful: backdating an import, or correcting a
  // date after publishing. Only the far future is a mistake worth catching.
  return { publishedAt: parsed };
}
