# Spec — Blog v1

Status: draft, for review.
Supersedes the content sections of `docs/2026-08-25-baseline-and-open-decisions.md`.

Read `CLAUDE.md` first for commands, architecture and gotchas. This spec does not
restate them.

## 1. Goal

Ship a public blog on fitoverforty: an archive, individual posts, tag archives, an
RSS feed, and a newsletter signup that puts subscribers into MailerLite lawfully.

Two technical authors write posts as markdown in this repository. Publishing is a
pull request. There is no CMS, no posts table, and no authoring UI in v1.

## 2. Decisions taken

| Decision                                                          | Rationale                                                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Content lives as markdown in the repo                             | Both authors are technical; ships fastest; prerenders perfectly; no auth or moderation surface            |
| Markdown becomes typed data in a **frontend build step**          | Keeps the backend off the content path; markdown/YAML parsers stay build-time and never reach the browser |
| Blog routes are **prerendered at build** (`outputMode: 'static'`) | Content is fully known at build time. Best SEO, no server on the content path, independent of PR #7       |
| Tag archives, newsletter CTA and RSS are **in v1**                | Tags shape URLs and are painful to retrofit; the feed is near-free once the contract exists               |
| Full-text search is **out of v1**                                 | Tag archives cover the need at low post counts; revisit past ~40 posts                                    |

### Relationship to PR #7 (SSR spike)

They do not collide, and v1 does not depend on the spike landing.

PR #7 wires **runtime** SSR — Angular rendered per request inside Nest. This spec
needs only **build-time** prerendering, which emits static HTML and needs no Node
process on the content path. Both use `@angular/ssr`, but through different output
modes, and only one output mode can be active at a time.

To keep the door open, render modes are declared in `app.routes.server.ts` from day
one even though v1 builds statically. If PR #7 later goes to production, that file
carries over unchanged: blog routes stay `RenderMode.Prerender`, and only
`outputMode` changes from `static` to `server`.

## 3. The content contract

The one architectural constraint from the baseline note: the rendering layer must
not know where a post came from. This is where that gets enforced.

New lib `libs/shared/content-model` (`@fitoverforty/content-model`) — framework-free
types, imported by both the Node generator and the Angular lib.

```ts
export type Iso8601Date = string; // 'YYYY-MM-DD'

export interface ImageRef {
  src: string; // app-absolute, e.g. '/assets/blog/<slug>/hero.jpg'
  alt: string;
  width: number;
  height: number;
}

export interface AuthorRef {
  id: string; // 'paul' | 'johan'
  name: string;
  avatar?: ImageRef;
}

export interface TagRef {
  slug: string; // kebab-case
  name: string; // display form
}

export interface Heading {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface PostSummary {
  slug: string;
  title: string;
  description: string; // <= 160 chars; drives meta, cards and the feed
  publishedAt: Iso8601Date;
  updatedAt?: Iso8601Date;
  authors: AuthorRef[];
  tags: TagRef[];
  hero?: ImageRef;
  readingTimeMinutes: number;
}

/** Discriminated so an Editor.js source can be added without touching the UI. */
export type PostBody = { kind: 'html'; html: string } | { kind: 'blocks'; blocks: unknown }; // reserved; not implemented in v1

export interface Post extends PostSummary {
  body: PostBody;
  headings: Heading[]; // for a future table of contents
}
```

The source itself is a port, provided through an injection token:

```ts
export interface ContentSource {
  listPosts(): PostSummary[];
  listTags(): TagRef[];
  postsByTag(tagSlug: string): PostSummary[];
  loadPost(slug: string): Promise<Post | undefined>;
}
```

v1 ships exactly one implementation, `GeneratedContentSource`, reading the build
output. A future API-backed or Editor.js-backed source implements the same interface
and no component changes.

`PostBody` being a union rather than a bare HTML string is the whole point. A
renderer that switches on `kind` costs nothing now; one that assumes HTML has to be
rewritten later.

## 4. Authoring format

```
content/
  authors.yml
  blog/
    tags.yml
    why-lifting-after-40-is-different/
      index.md
      hero.jpg
```

The directory name **is** the slug. The filesystem then guarantees slugs are unique
and URL-safe, and images live next to the post that uses them.

```yaml
---
title: Why lifting after 40 is different
description: What actually changes in your forties, and what to do about it.
publishedAt: 2026-09-01
updatedAt: 2026-10-14 # optional
authors: [paul]
tags: [strength, recovery]
hero:
  src: ./hero.jpg
  alt: A lifter racking a barbell mid-set
draft: false # optional, defaults to false
---
Body markdown starts here.
```

`authors.yml` and `tags.yml` are closed vocabularies. With two authors, uncontrolled
tags sprawl into near-duplicates within a dozen posts, so an unknown tag is a build
failure, not a new tag.

### Build-time validation

The generator **fails the build** on any of: a missing required field; a description
over 160 characters; an unknown author or tag id; a hero or inline image with no
`alt`; an image file that does not exist; an unparseable or future-invalid date; a
tag slug that is not kebab-case; a duplicate slug.

Failing loudly at build time is deliberate — the alternative is discovering a broken
post in production, where the only fix is another deploy.

### Drafts and scheduling

`draft: true`, or a `publishedAt` in the future, excludes a post from a production
build. `--include-drafts` includes both, and `nx serve` sets it. Unfinished posts can
therefore sit on `main` safely.

## 5. The content build step

New lib `libs/content/blog-source` (`@fitoverforty/content-blog-source`), Node-only,
Vitest. This introduces a `libs/content/*` grouping alongside the existing
`libs/frontend/*`; Nx tags keep Angular code from importing it.

Exposed as target `fitoverforty-frontend:content`, which `build`, `serve`, `test` and
`e2e` declare in `dependsOn`. A `--watch` flag uses `fs.watch(dir, { recursive: true })`
— no new runtime dependency — so editing a post during `nx serve` regenerates.

Build-time dependencies, all `devDependencies` and none of which reach the browser:
`gray-matter` (frontmatter), `markdown-it` (rendering), `image-size` (intrinsic
dimensions, so `<img>` carries `width`/`height` and avoids layout shift).

### Output

Generated into `apps/fitoverforty/frontend/src/app/blog/generated/`, gitignored:

```
generated/
  index.ts            // PostSummary[], TagRef[], and a slug -> loader map
  posts/<slug>.ts     // one module per post, containing the full Post
```

Bodies are **not** in the index. Each post is its own module reached through a
generated dynamic-import map:

```ts
export const postLoaders: Record<string, () => Promise<{ post: Post }>> = {
  'why-lifting-after-40-is-different': () => import('./posts/why-lifting-after-40-is-different'),
};
```

esbuild code-splits each post into its own chunk, so the archive page does not ship
every post's HTML. Just as importantly, the prerenderer resolves these imports
in-process — no HTTP, no base-URL problem, no `HttpClient` during prerender.

Also emitted, into `apps/fitoverforty/frontend/src/assets/`:

- `blog/<slug>/*` — post images, with markdown `./foo.jpg` references rewritten
- `feed.xml`, `sitemap.xml`, `robots.txt`

### HTML sanitisation

Rendered markdown is bound with `[innerHTML]` through
`DomSanitizer.bypassSecurityTrustHtml`.

This is safe **only** because content is trusted: it arrives through a reviewed pull
request from one of two authors, never from a user. That assumption is load-bearing.
If content ever becomes user-supplied — the Editor.js CMS direction — this must
become real sanitisation before that source is wired up. The bypass call gets a
comment saying so.

## 6. Routes

| Path             | Page                                        | Render mode        |
| ---------------- | ------------------------------------------- | ------------------ |
| `/`              | Home: intro, latest 6 posts, newsletter CTA | Prerender          |
| `/blog`          | Paginated archive, 10 per page              | Prerender          |
| `/blog/page/:n`  | Archive page n                              | Prerender (params) |
| `/blog/:slug`    | Post detail                                 | Prerender (params) |
| `/blog/tags`     | Tag index with post counts                  | Prerender          |
| `/blog/tag/:tag` | Tag archive                                 | Prerender (params) |
| `/contact`       | Existing contact form                       | **Client**         |

`getPrerenderParams` enumerates slugs, tags and page numbers from the generated index.

`/` currently redirects to `/contact`; that redirect goes. Home becomes a real page.
It shows excerpts only and canonicalises to `/`, while `/blog` is the full archive —
distinct pages, not duplicate content.

`/contact` stays client-rendered because `@anarchitects/forms-angular` fetches its
configuration from the backend at runtime. There is nothing to prerender and no SEO
value in trying.

Unknown slugs render a 404 page. Under static output there is no server to return a
404 status, so hosting is configured to serve `404.html` — Johan's call on the
platform, flagged in §11.

## 7. UI

New lib `libs/frontend/blog` (project `fitoverforty-frontend-blog`, alias
`@fitoverforty/frontend-blog`, selector prefix `fitoverforty-`, standalone, `OnPush`,
Vitest), following the existing header/footer conventions.

Components: post card, post list, pagination, tag chip, tag list, post header
(title, authors, date, reading time), post body renderer (switches on `PostBody.kind`),
newsletter CTA.

**Prerequisite, before any of this is written:** read the READMEs for
`@anarchitects/common-angular-ui-primitives`, `-ui-composition`, `-ui-layouts` and
`-angular-design`, per the Bricks README-first overlay in `AGENTS.md`. Card, stack,
prose and typography treatments may already exist there, and this app exists partly to
dogfood them. Assume nothing about what is available; hand-rolling something the
design system already provides is the failure mode to avoid.

Styling follows the existing three-tier custom-property system. No colour is
hardcoded outside `frontend/src/styles/themes.css`.

## 8. SEO

Per route: `<title>`, meta description, canonical link, OpenGraph and Twitter card
tags, and JSON-LD `BlogPosting` on post pages. All of it lands in prerendered HTML.

`sitemap.xml` and `robots.txt` come from the content build step. `SITE_URL` supplies
the origin for absolute URLs.

## 9. RSS

`/blog/feed.xml` — RSS 2.0 with an `<atom:link rel="self">`, the 20 most recent
published posts, newest first. Each item carries title, link, guid (the canonical
URL, `isPermaLink="true"`), `pubDate` and the post description.

Descriptions rather than full bodies: lighter, and it keeps readers arriving on pages
that carry the newsletter CTA.

## 10. Newsletter

The heaviest part of v1, because consent is a legal obligation rather than a feature.

### Shape

`POST /api/newsletter/subscribe`, body `{ email, consent, source, honeypot }`.

Backend `NewsletterModule` implements it behind a `SubscriberPort` interface with a
`MailerLiteSubscriberAdapter`. The MailerLite API key is server-side only and never
reaches the browser.

### Deviation from "forms are configuration"

Everything else form-shaped in this app is a database row rendered by
`@anarchitects/forms-angular`. The newsletter CTA is not, and that is deliberate: it
is embedded in every prerendered blog page, and a runtime config fetch on each one
would defeat prerendering entirely for a control with one email field and one
checkbox.

The server side still mirrors the `forms-nest` `delivery` shape, so that if
`forms-nest` grows a subscriber delivery target — package candidate #2 in the
baseline note — this collapses into it rather than being rewritten.

**This is the deviation most worth arguing with.** If the preference is to keep every
form going through the forms stack, say so and the CTA becomes a configured form on
the archive and home pages only, not on every post.

### UK GDPR / PECR

- **Double opt-in** is handled by MailerLite: the subscriber is created as
  `unconfirmed` in a group with double opt-in enabled, and MailerLite sends the
  confirmation. No confirmation-token flow is needed in this app. The group must be
  configured for double opt-in **in the MailerLite UI** — a setting outside this repo
  and easy to get wrong.
- **One-click unsubscribe** is handled by MailerLite in campaign emails.
- **Consent must be affirmative**: an unticked checkbox, separate from any other
  purpose, with a link to the privacy policy. No pre-tick, no bundling.
- **Consent is recorded locally** in a `newsletter_consent` table — email, UTC
  timestamp, source URL, IP, and the consent wording version from
  `NEWSLETTER_CONSENT_VERSION`. Owning the audit trail matters; relying on the ESP's
  record leaves nothing to produce if we ever change provider.
- The wording is versioned so a change to it is visible in the record rather than
  silently retconning what people agreed to.

A privacy policy page is therefore a v1 requirement, not a nicety.

### Abuse

A honeypot field plus per-IP rate limiting on the endpoint. Enough for a small blog;
not a CAPTCHA.

### Environment

`MAILERLITE_API_KEY`, `MAILERLITE_GROUP_ID`, `MAILERLITE_API_URL`, `SITE_URL`,
`NEWSLETTER_CONSENT_VERSION` — documented in `env.example`.

Note the mailer gotcha in `CLAUDE.md`: placeholder defaults mean unset does not mean
disabled, and the failure surfaces late. The newsletter config does the opposite —
**fail fast at boot** if `MAILERLITE_API_KEY` is missing while the feature is enabled.

## 11. Testing and CI

- **Generator** (Vitest): fixture content directories covering frontmatter
  validation, unknown-tag failure, draft and future-date exclusion, reading time,
  image URL rewriting, slug collisions.
- **Blog lib** (Vitest): component rendering, both `PostBody` kinds routed correctly.
- **Backend e2e** (Jest): subscribe endpoint against a faked `SubscriberPort` —
  happy path, invalid email, absent consent rejected, consent row persisted, honeypot
  rejected. No live MailerLite calls in CI.
- **Playwright**: archive to post navigation, tag filtering, `/blog/feed.xml` returns
  well-formed XML, newsletter happy path.
- **CI prerender assertion**: after `build`, assert that a post's emitted HTML file
  contains the post title as text. This is the check that catches a silent regression
  to client-only rendering, which is otherwise invisible until search rankings move.

Reading time is `ceil(words / 200)`, minimum 1.

## 12. Out of scope for v1

Full-text search, comments, related posts, author profile pages, series, i18n,
Editor.js or any CMS, and the shop. Named individually so they read as deferred
rather than forgotten.

## 13. Open questions

1. **404 handling under static output.** Needs the hosting platform's rewrite rule.
   Johan's call.
2. **Do the `@anarchitects` UI packages already cover prose typography and cards?**
   Answered by reading the READMEs — first task of §7, and it may shrink that section.
3. **Home page content.** This spec assumes intro plus latest posts plus CTA. If the
   site wants a real landing page with positioning copy, that is a separate design
   conversation.
4. **Author avatars.** `AuthorRef.avatar` is modelled but the images do not exist.
5. **Pagination size** of 10 is a guess and cheap to change before launch.

## 14. Milestones

1. `content-model` types and `blog-source` generator, with tests, generating from
   two real posts.
2. Prerendering: `app.routes.server.ts`, `outputMode: 'static'`, archive and detail
   routes rendering, CI prerender assertion.
3. Tags: vocabulary, tag index, tag archives.
4. Feed, sitemap, robots, SEO metadata and JSON-LD.
5. Newsletter: port, MailerLite adapter, consent persistence, CTA component, privacy
   policy page.
6. Playwright coverage and the `env.example` update.

Each milestone is independently mergeable. 1 and 2 together are already a publishable
blog; 5 is the only one carrying legal risk and should not be rushed to meet 1–4.
