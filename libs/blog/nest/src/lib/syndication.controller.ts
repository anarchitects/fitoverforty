import { Controller, Get, Header, Inject, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { ContentSource } from '@fitoverforty/blog-ts';
import { CONTENT_SOURCE } from './content-source.token';
import { escapeXml, siteOrigin } from './site-url';
import { indexingAllowed } from './indexing';

const FEED_ITEM_LIMIT = 20;
const SITE_TITLE = 'Fit Over Forty';
const SITE_DESCRIPTION =
  'Training, recovery and nutrition for people who did not start yesterday.';

/**
 * Serves the feed, sitemap and robots.txt.
 *
 * These live outside the /api prefix because they are public documents with
 * fixed, conventional URLs — main.ts excludes them from the global prefix.
 */
@Controller()
export class SyndicationController {
  constructor(
    @Inject(CONTENT_SOURCE) private readonly content: ContentSource,
  ) {}

  @Get('blog/feed.xml')
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  async feed(@Req() request: FastifyRequest): Promise<string> {
    const origin = siteOrigin(request);
    const { items } = await this.content.listPosts(1, FEED_ITEM_LIMIT);

    // Descriptions rather than full bodies: lighter, and it keeps readers
    // arriving on pages that carry the newsletter CTA.
    const entries = items
      .map((post) => {
        const url = `${origin}/blog/${post.slug}`;
        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(post.description)}</description>
${post.tags
  .map((tag) => `      <category>${escapeXml(tag.name)}</category>`)
  .join('\n')}
    </item>`;
      })
      .join('\n');

    const lastBuild = items.length
      ? new Date(items[0].publishedAt).toUTCString()
      : new Date().toUTCString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(origin)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en-GB</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${escapeXml(`${origin}/blog/feed.xml`)}" rel="self" type="application/rss+xml"/>
${entries}
  </channel>
</rss>
`;
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async sitemap(@Req() request: FastifyRequest): Promise<string> {
    const origin = siteOrigin(request);
    const [posts, tags, pillars, authors] = await Promise.all([
      this.content.listPublishedRefs(),
      this.content.listTags(),
      this.content.listPillars(),
      this.content.listAuthorRefs(),
    ]);

    const url = (path: string, lastmod?: string) =>
      `  <url>\n    <loc>${escapeXml(`${origin}${path}`)}</loc>${
        lastmod ? `\n    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''
      }\n  </url>`;

    const entries = [
      url('/'),
      url('/blog'),
      url('/blog/tags'),
      url('/blog/pillars'),
      url('/about'),
      url('/contact'),
      url('/privacy'),
      // Every pillar, including any with no posts yet — unlike tags, which
      // only exist once something carries them. The four are permanent URLs.
      ...pillars.map((pillar) => url(`/blog/pillar/${pillar.slug}`)),
      ...tags.map((tag) => url(`/blog/tag/${tag.slug}`)),
      // There is deliberately no /blog/authors index — an author page is
      // reached from a byline — but the pages themselves are public URLs with
      // prose on them, and a crawler has no byline to follow.
      ...authors.map((author) => url(`/blog/author/${author.slug}`)),
      ...posts.map((post) =>
        url(`/blog/${post.slug}`, post.updatedAt ?? post.publishedAt),
      ),
    ].join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
  }

  /**
   * Note what this does *not* do on an instance that is not to be indexed: it
   * does not answer `Disallow: /`. Blocking the crawl would stop it reading
   * the `X-Robots-Tag: noindex` that `NoIndexHeader` puts on every response,
   * and a URL it cannot fetch is one it can still list from someone else's
   * link. Letting it in to be told no is the only combination that works; see
   * the note on `NoIndexHeader`.
   */
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  robots(@Req() request: FastifyRequest): string {
    const origin = siteOrigin(request);
    // /admin is disallowed ahead of Phase B, so the authoring area is never
    // crawled even briefly after it lands.
    const rules = `User-agent: *
Disallow: /admin
Allow: /
`;

    if (!indexingAllowed()) {
      // No sitemap line: this instance has nothing it wants found, and the
      // sitemap is the one file whose whole purpose is to hand a crawler URLs
      // it had not discovered yet. The comment is for whoever reads this
      // wondering why the site is missing from search.
      return `# ALLOW_INDEXING is not set, so every response from this
# instance carries X-Robots-Tag: noindex, nofollow. Crawling is
# permitted precisely so that header can be read.
${rules}`;
    }

    return `${rules}
Sitemap: ${origin}/sitemap.xml
`;
  }
}
