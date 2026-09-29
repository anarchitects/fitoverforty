import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_ORIGIN } from './site-origin.token';

export interface SeoInput {
  title: string;
  description: string;
  /** Absolute path, e.g. '/blog/some-slug'. Becomes the canonical URL. */
  path: string;
  type?: 'website' | 'article';
  publishedAt?: string;
  modifiedAt?: string;
  authors?: string[];
  tags?: string[];
  /** Absolute or site-relative image URL. */
  image?: string;
  noIndex?: boolean;
}

const SITE_NAME = 'Fit Over Forty';
const JSON_LD_ID = 'blog-json-ld';

/**
 * The card served when a page names no image of its own.
 *
 * Every page having one matters more than any page having the perfect one: a
 * link with no `og:image` is rendered by most platforms as a bare grey box
 * with the URL under it, which reads as a broken or untrustworthy link rather
 * than a plain one. Rendered by `@fitoverforty/og-nest`.
 */
const DEFAULT_IMAGE = '/og/site.png';

/**
 * Sets per-page metadata.
 *
 * Everything here manipulates the document, so it works identically under
 * server rendering — which is the point: these tags are only worth setting if
 * they are in the HTML a crawler receives, not added afterwards by script.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly titleService = inject(Title);
  private readonly document = inject(DOCUMENT);
  private readonly origin = inject(SITE_ORIGIN);

  apply(input: SeoInput): void {
    const url = `${this.origin}${input.path}`;
    const fullTitle =
      input.title === SITE_NAME ? SITE_NAME : `${input.title} — ${SITE_NAME}`;

    this.titleService.setTitle(fullTitle);
    this.setName('description', input.description);

    // A not-found or error page that is indexable is worse than one that is
    // missing: it competes with the real pages. It also gets no canonical —
    // there is no canonical URL for a page that should not exist, and pointing
    // one at a placeholder path is worse than saying nothing.
    if (input.noIndex) {
      this.setName('robots', 'noindex, follow');
      this.removeCanonical();
    } else {
      this.removeName('robots');
      this.setCanonical(url);
    }

    this.setProperty('og:type', input.type ?? 'website');
    this.setProperty('og:site_name', SITE_NAME);
    this.setProperty('og:title', fullTitle);
    this.setProperty('og:description', input.description);
    this.setProperty('og:url', url);

    /**
     * Always the large card: there is now always an image, and every one of
     * them — a hero photo or a generated card — is 1200×630 or wider, which
     * is the size this variant expects.
     */
    this.setName('twitter:card', 'summary_large_image');
    this.setName('twitter:title', fullTitle);
    this.setName('twitter:description', input.description);

    const source = input.image ?? DEFAULT_IMAGE;
    const image = source.startsWith('http')
      ? source
      : `${this.origin}${source}`;
    this.setProperty('og:image', image);
    this.setName('twitter:image', image);

    if (input.type === 'article') {
      if (input.publishedAt) {
        this.setProperty('article:published_time', input.publishedAt);
      }
      if (input.modifiedAt) {
        this.setProperty('article:modified_time', input.modifiedAt);
      }
      this.setArticleTags(input.tags ?? []);
    } else {
      this.removeProperty('article:published_time');
      this.removeProperty('article:modified_time');
      this.setArticleTags([]);
    }

    this.setJsonLd(this.buildJsonLd(input, url, image));
  }

  private buildJsonLd(
    input: SeoInput,
    url: string,
    image: string | undefined,
  ): Record<string, unknown> {
    if (input.type !== 'article') {
      return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: this.origin,
      };
    }

    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: input.title,
      description: input.description,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      url,
      ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
      ...(input.modifiedAt ? { dateModified: input.modifiedAt } : {}),
      ...(image ? { image: [image] } : {}),
      ...(input.authors?.length
        ? {
            author: input.authors.map((name) => ({ '@type': 'Person', name })),
          }
        : {}),
      ...(input.tags?.length ? { keywords: input.tags.join(', ') } : {}),
      publisher: { '@type': 'Organization', name: SITE_NAME },
    };
  }

  private setJsonLd(data: Record<string, unknown>): void {
    const head = this.document.head;
    let script = head.querySelector<HTMLScriptElement>(`#${JSON_LD_ID}`);
    if (!script) {
      script = this.document.createElement('script');
      script.id = JSON_LD_ID;
      script.type = 'application/ld+json';
      head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }

  private setArticleTags(tags: string[]): void {
    for (const existing of this.meta.getTags('property="article:tag"')) {
      existing.remove();
    }
    for (const tag of tags) {
      this.meta.addTag({ property: 'article:tag', content: tag });
    }
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private removeCanonical(): void {
    this.document.head.querySelector('link[rel="canonical"]')?.remove();
  }

  private setName(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private removeName(name: string): void {
    this.meta.removeTag(`name="${name}"`);
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property="${property}"`);
  }

  private removeProperty(property: string): void {
    this.meta.removeTag(`property="${property}"`);
  }
}
