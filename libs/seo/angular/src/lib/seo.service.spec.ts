import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { SeoService } from './seo.service';
import { SITE_ORIGIN } from './site-origin.token';

const ORIGIN = 'https://example.test';

describe('SeoService', () => {
  let seo: SeoService;
  let document: Document;

  const meta = (selector: string) =>
    document.head.querySelector<HTMLMetaElement>(selector)?.content;
  const canonical = () =>
    document.head
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.getAttribute('href');
  const jsonLd = () =>
    JSON.parse(
      document.head.querySelector('#blog-json-ld')?.textContent ?? '{}',
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SITE_ORIGIN, useValue: ORIGIN }],
    });
    seo = TestBed.inject(SeoService);
    document = TestBed.inject(DOCUMENT);
    // The head is shared across tests in one jsdom document, so anything a
    // previous case added would otherwise look like this one's output.
    document.head.querySelectorAll('meta, link[rel="canonical"], #blog-json-ld')
      .forEach((node) => node.remove());
  });

  const page = {
    title: 'A Post',
    description: 'What it is about.',
    path: '/blog/a-post',
  };

  it('suffixes the title with the site name', () => {
    seo.apply(page);
    expect(document.title).toBe('A Post — Fit Over Forty');
  });

  it('does not suffix the site name onto itself', () => {
    // Otherwise the home page reads "Fit Over Forty — Fit Over Forty".
    seo.apply({ ...page, title: 'Fit Over Forty' });
    expect(document.title).toBe('Fit Over Forty');
  });

  it('builds the canonical URL from the origin and path', () => {
    seo.apply(page);
    expect(canonical()).toBe(`${ORIGIN}/blog/a-post`);
    expect(meta('meta[property="og:url"]')).toBe(`${ORIGIN}/blog/a-post`);
  });

  describe('noIndex', () => {
    it('marks the page noindex and removes the canonical', () => {
      // A not-found page that is indexable competes with the real pages, and
      // there is no canonical URL for a page that should not exist.
      seo.apply({ ...page, noIndex: true });
      expect(meta('meta[name="robots"]')).toBe('noindex, follow');
      expect(canonical()).toBeUndefined();
    });

    it('clears robots again on the next indexable page', () => {
      // The service is a singleton applied per navigation, so a stale robots
      // tag would silently de-index every page visited after a 404.
      seo.apply({ ...page, noIndex: true });
      seo.apply(page);
      expect(meta('meta[name="robots"]')).toBeUndefined();
      expect(canonical()).toBe(`${ORIGIN}/blog/a-post`);
    });
  });

  describe('images', () => {
    it('makes a site-relative image absolute', () => {
      seo.apply({ ...page, image: '/media/hero.png' });
      expect(meta('meta[property="og:image"]')).toBe(
        `${ORIGIN}/media/hero.png`,
      );
    });

    it('leaves an absolute image alone', () => {
      const remote = 'https://cdn.example.test/hero.png';
      seo.apply({ ...page, image: remote });
      expect(meta('meta[property="og:image"]')).toBe(remote);
    });

    it('switches the twitter card type on whether there is an image', () => {
      seo.apply(page);
      expect(meta('meta[name="twitter:card"]')).toBe('summary');
      seo.apply({ ...page, image: '/media/hero.png' });
      expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    });

    it('removes a previous page image rather than carrying it over', () => {
      seo.apply({ ...page, image: '/media/hero.png' });
      seo.apply(page);
      expect(meta('meta[property="og:image"]')).toBeUndefined();
    });
  });

  describe('JSON-LD', () => {
    it('emits WebSite for an ordinary page', () => {
      seo.apply(page);
      expect(jsonLd()).toMatchObject({ '@type': 'WebSite', url: ORIGIN });
    });

    it('emits BlogPosting with authors and keywords for an article', () => {
      seo.apply({
        ...page,
        type: 'article',
        publishedAt: '2026-08-01T09:00:00.000Z',
        authors: ['Paul', 'Johan'],
        tags: ['Strength', 'Recovery'],
      });

      expect(jsonLd()).toMatchObject({
        '@type': 'BlogPosting',
        headline: 'A Post',
        datePublished: '2026-08-01T09:00:00.000Z',
        keywords: 'Strength, Recovery',
        author: [
          { '@type': 'Person', name: 'Paul' },
          { '@type': 'Person', name: 'Johan' },
        ],
      });
    });

    it('replaces the block rather than appending a second one', () => {
      // Two ld+json blocks on one page is not an error a crawler reports.
      seo.apply({ ...page, type: 'article' });
      seo.apply(page);
      expect(document.head.querySelectorAll('#blog-json-ld')).toHaveLength(1);
      expect(jsonLd()['@type']).toBe('WebSite');
    });
  });

  describe('article tags', () => {
    it('clears the previous post’s tags', () => {
      // article:tag is additive in Angular's Meta service, so without the
      // clear every post would accumulate every earlier post's tags.
      seo.apply({ ...page, type: 'article', tags: ['Strength'] });
      seo.apply({ ...page, type: 'article', tags: ['Recovery'] });

      const tags = [
        ...document.head.querySelectorAll<HTMLMetaElement>(
          'meta[property="article:tag"]',
        ),
      ].map((node) => node.content);
      expect(tags).toEqual(['Recovery']);
    });

    it('drops article metadata when moving to a non-article page', () => {
      seo.apply({
        ...page,
        type: 'article',
        publishedAt: '2026-08-01T09:00:00.000Z',
        tags: ['Strength'],
      });
      seo.apply(page);

      expect(meta('meta[property="article:published_time"]')).toBeUndefined();
      expect(
        document.head.querySelectorAll('meta[property="article:tag"]'),
      ).toHaveLength(0);
    });
  });
});
