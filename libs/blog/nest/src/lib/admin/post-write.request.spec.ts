import { BadRequestException } from '@nestjs/common';
import { parseDraftBody, parsePublishBody } from './post-write.request';

const valid = {
  title: 'Lifting After Forty',
  description: 'Where to start, and what to stop worrying about.',
  body: { blocks: [] },
};

describe('parseDraftBody', () => {
  it('derives a slug from the title when none is given', () => {
    expect(parseDraftBody(valid).slug).toBe('lifting-after-forty');
  });

  it('prefers an explicit slug, slugified', () => {
    expect(parseDraftBody({ ...valid, slug: 'Start Here!' }).slug).toBe(
      'start-here',
    );
  });

  it('falls back to the title when the slug is blank', () => {
    // An emptied field should behave like an absent one, or clearing the box
    // to "let it derive again" would instead be an error.
    expect(parseDraftBody({ ...valid, slug: '   ' }).slug).toBe(
      'lifting-after-forty',
    );
  });

  it('refuses a title with nothing sluggable in it', () => {
    expect(() => parseDraftBody({ ...valid, title: '!!!' })).toThrow(
      BadRequestException,
    );
  });

  it('caps the description at the length the column allows', () => {
    expect(() =>
      parseDraftBody({ ...valid, description: 'x'.repeat(161) }),
    ).toThrow(/160 characters or fewer/);
  });

  it('passes the body through untouched', () => {
    // sanitiseBody is the only thing allowed an opinion about blocks; this
    // asserts the parser does not quietly pre-empt it.
    const body = { blocks: [{ type: 'nonsense', data: {} }] };
    expect(parseDraftBody({ ...valid, body }).body).toBe(body);
  });

  it('slugifies tags and collapses ones that agree', () => {
    expect(
      parseDraftBody({
        ...valid,
        tags: ['Strength Training', 'strength training', 'Mobility'],
      }).tags,
    ).toEqual([
      { slug: 'strength-training', name: 'Strength Training' },
      { slug: 'mobility', name: 'Mobility' },
    ]);
  });

  it('drops blank tags rather than failing on them', () => {
    // A trailing comma in a tag input is a typo, not an error worth a 400.
    expect(parseDraftBody({ ...valid, tags: ['Rest', '  '] }).tags).toEqual([
      { slug: 'rest', name: 'Rest' },
    ]);
  });

  it('refuses more tags than a post should carry', () => {
    const tags = Array.from({ length: 9 }, (_, i) => `tag-${i}`);
    expect(() => parseDraftBody({ ...valid, tags })).toThrow(/at most 8 tags/);
  });

  it('refuses a hero id that is not an id', () => {
    expect(() =>
      parseDraftBody({ ...valid, heroMediaId: 'not-a-uuid' }),
    ).toThrow(/must be a media id or null/);
  });

  it('accepts a null hero, meaning "remove it"', () => {
    expect(parseDraftBody({ ...valid, heroMediaId: null }).heroMediaId).toBe(
      null,
    );
  });
});

describe('parsePublishBody', () => {
  const now = new Date('2026-08-27T10:00:00.000Z');

  it('means now when nothing is given', () => {
    expect(parsePublishBody(undefined, now).publishedAt).toEqual(now);
    expect(parsePublishBody({}, now).publishedAt).toEqual(now);
  });

  it('schedules a future date', () => {
    const at = '2026-09-01T09:00:00.000Z';
    expect(parsePublishBody({ publishedAt: at }, now).publishedAt).toEqual(
      new Date(at),
    );
  });

  it('allows a past date, for backdating', () => {
    const at = '2020-01-01T00:00:00.000Z';
    expect(parsePublishBody({ publishedAt: at }, now).publishedAt).toEqual(
      new Date(at),
    );
  });

  it('refuses a date more than a year ahead', () => {
    // "2260" is a plausible typo for "2026" and would sit in the table
    // invisibly forever.
    expect(() =>
      parsePublishBody({ publishedAt: '2260-08-27T10:00:00.000Z' }, now),
    ).toThrow(/more than a year ahead/);
  });

  it('refuses something that is not a date', () => {
    expect(() => parsePublishBody({ publishedAt: 'soon' }, now)).toThrow(
      /not a date I can read/,
    );
  });
});
