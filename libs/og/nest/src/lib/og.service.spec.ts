import type { ContentSource, Post } from '@fitoverforty/blog-ts';
import { OgService } from './og.service';
import type { OgRenderer } from './og-renderer';
import type { CardInput } from './og-card';

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    slug: 'a-post',
    title: 'A post',
    description: 'About something.',
    body: { blocks: [], schemaVersion: 1 },
    publishedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    authors: [],
    tags: [],
    readingTimeMinutes: 1,
    headings: [],
    ...overrides,
  } as unknown as Post;
}

describe('OgService', () => {
  let rendered: CardInput[];
  let renderer: OgRenderer;
  let loadPost: jest.Mock;

  function serviceFor(source: Partial<ContentSource>): OgService {
    return new OgService(renderer, source as ContentSource);
  }

  beforeEach(() => {
    rendered = [];
    let n = 0;
    renderer = {
      render: jest.fn(async (input: CardInput) => {
        rendered.push(input);
        return Buffer.from(`png-${n++}`);
      }),
    } as unknown as OgRenderer;
    loadPost = jest.fn(async () => post());
  });

  it('renders a post card from the post', async () => {
    const og = serviceFor({ loadPost });
    await og.forPost('a-post', 'fitoverforty.test');

    expect(rendered[0]).toMatchObject({
      title: 'A post',
      description: 'About something.',
      kicker: 'fitoverforty.test',
    });
  });

  it('carries the pillar name onto the card', async () => {
    const withPillar = jest.fn(async () =>
      post({ pillar: { slug: 'physical-fitness', name: 'Physical fitness' } }),
    );
    await serviceFor({ loadPost: withPillar }).forPost('a-post', 'x');

    expect(rendered[0].pillar).toBe('Physical fitness');
  });

  it('answers undefined for a post that is not published', async () => {
    // Honest 404: a placeholder card would let a mistyped slug sit in
    // someone's timeline looking deliberate.
    const missing = jest.fn(async () => undefined);
    const og = serviceFor({ loadPost: missing });

    expect(await og.forPost('nope', 'x')).toBeUndefined();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('renders a given post only once', async () => {
    const og = serviceFor({ loadPost });
    const [a, b] = [
      await og.forPost('a-post', 'x'),
      await og.forPost('a-post', 'x'),
    ];

    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it('re-renders after the post is edited', async () => {
    // The cache key carries updatedAt, so a republished post must not keep
    // serving the card built from its old title.
    let stamp = '2026-01-02T00:00:00.000Z';
    const edited = jest.fn(async () => post({ updatedAt: stamp }));
    const og = serviceFor({ loadPost: edited });

    await og.forPost('a-post', 'x');
    stamp = '2026-02-02T00:00:00.000Z';
    await og.forPost('a-post', 'x');

    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it('caches the site card too', async () => {
    const og = serviceFor({ loadPost });
    await og.forSite('x');
    await og.forSite('x');

    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(rendered[0].title).toBe('Fit Over Forty');
  });

  it('keeps the cache bounded', async () => {
    // An unbounded map in a process that runs for months is a slow leak, and
    // the keys are attacker-influenced: any slug can be requested.
    const og = serviceFor({
      loadPost: jest.fn(async (slug: string) => post({ slug })),
    });

    for (let i = 0; i < 80; i++) await og.forPost(`post-${i}`, 'x');
    // The first entries have been evicted, so re-requesting one renders again.
    await og.forPost('post-0', 'x');

    expect(renderer.render).toHaveBeenCalledTimes(81);
  });
});
