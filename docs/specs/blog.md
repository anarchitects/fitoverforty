# Spec — Blog v1

Status: draft, second revision.
Supersedes the content sections of `docs/2026-08-25-baseline-and-open-decisions.md`.

Read `CLAUDE.md` first for commands, architecture and gotchas. This spec does not
restate them.

## 1. Goal

Ship a public blog on fitoverforty: an archive, individual posts, tag archives, an
RSS feed, and a newsletter signup that puts subscribers into MailerLite lawfully.

Posts are authored in **Editor.js**, stored as structured JSON, and published from an
authenticated admin area. Publishing is a button, not a deploy.

## 2. What changed since the first revision

The first draft specified markdown files in the repo, parsed at build time and
prerendered. Following review, content moves to Editor.js integrated with Angular via
Anarchitects Community packages (community epics #66–#74).

That is not a swap of one content source for another. It changes four things:

| Area      | First revision                    | This revision                            |
| --------- | --------------------------------- | ---------------------------------------- |
| Storage   | Markdown files in git             | Editor.js `OutputData` JSON in Postgres  |
| Rendering | Prerendered at build, no server   | Runtime SSR — **this now depends on #7** |
| Authoring | A pull request                    | Admin UI, which requires authentication  |
| Media     | Images committed next to the post | Uploads, which require object storage    |

**The one thing that survived intact is the content contract.** `PostBody` was defined
as a discriminated union precisely so an Editor.js source would not force a UI rewrite,
and that has now paid off: `{ kind: 'blocks' }` becomes the primary shape and no
consumer of the port changes. §4 is largely as reviewed.

**Scope roughly doubles.** Auth, an admin shell, editor integration, upload storage and
a block renderer are all new surface that markdown did not need. §14 proposes a phase
split that lets the public blog ship without waiting for the full authoring stack.

## 3. Decisions taken

| Decision                                             | Rationale                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Content is Editor.js `OutputData` in Postgres        | Reviewed decision. Aligns the app with community epics #66–#74 and makes this app where that shape is proven |
| Blog routes are **server-rendered per request**      | Content changes without a deploy, so build-time output cannot stay correct                                   |
| Tag archives, newsletter CTA and RSS are in v1       | Tags shape URLs and are painful to retrofit; the feed is near-free once the contract exists                  |
| Full-text search is out of v1                        | Tag archives cover the need at low post counts; revisit past ~40 posts                                       |
| Auth via `@anarchitects/better-auth-typeorm-adapter` | Published at 0.1.1, already TypeORM-and-Postgres shaped, and dogfoods the ecosystem                          |

### This revision depends on #7

The first draft argued the blog was independent of the SSR spike. **That is no longer
true, and it is the most important consequence of this change.**

Build-time prerendering only works when content is known at build time. Once a post can
be published from an admin UI, the rendered output has to be produced per request or it
goes stale the moment anyone publishes. Blog routes therefore render through
`@anarchitects/nest-angular-ssr` — the package #7 spikes.

#7 is approved but still carries the unresolved items listed in its own description and
in community issue #501: build ordering, the dev/prod topology split, and CI asserting a
rendered response. Those now block the blog rather than sitting beside it, and should be
closed out before §8 is built on top.

## 4. The content contract

Unchanged from the reviewed draft except where noted. The rendering layer must not know
where a post came from.

New lib `libs/shared/content-model` (`@fitoverforty/content-model`) — framework-free
types, imported by the backend, the frontend and any future package extraction.

```ts
export type Iso8601 = string;

export interface ImageRef {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface AuthorRef {
  id: string;
  name: string;
  avatar?: ImageRef;
}

export interface TagRef {
  slug: string; // kebab-case
  name: string;
}

export interface PostSummary {
  slug: string;
  title: string;
  description: string; // <= 160 chars; drives meta, cards and the feed
  publishedAt: Iso8601;
  updatedAt?: Iso8601;
  authors: AuthorRef[];
  tags: TagRef[];
  hero?: ImageRef;
  readingTimeMinutes: number;
}

/** `blocks` is the v1 shape. `html` is retained for imported or legacy content. */
export type PostBody = { kind: 'blocks'; blocks: OutputData } | { kind: 'html'; html: string };

export interface Post extends PostSummary {
  body: PostBody;
  headings: Heading[];
}

export interface Heading {
  depth: 2 | 3;
  id: string;
  text: string;
}
```

`OutputData` is Editor.js's own type. Epic #66 (`@anarchitects/editorjs-core`) will own
the canonical typing; until it exists, this lib re-exports the type from `@editorjs/editorjs`
behind our own alias so the later switch is one import change.

The source stays a port:

```ts
export interface ContentSource {
  listPosts(page: number, perPage: number): Promise<Paged<PostSummary>>;
  listTags(): Promise<TagRef[]>;
  postsByTag(tagSlug: string, page: number, perPage: number): Promise<Paged<PostSummary>>;
  loadPost(slug: string): Promise<Post | undefined>;
}
```

Now async throughout, since the source is a database rather than a generated module.

## 5. Data model

New `blog` schema, following the existing convention that forms tables live in `forms`
rather than `public`. Migrations under `backend/tools/typeorm/migrations/`.

```
blog.posts
  id                    uuid pk
  slug                  text unique not null
  title                 text not null
  description           text not null
  body                  jsonb not null      -- Editor.js OutputData
  body_schema_version   int not null        -- our version, not Editor.js's
  status                text not null       -- 'draft' | 'published'
  published_at          timestamptz null
  reading_time_minutes  int not null
  hero_media_id         uuid null -> blog.media
  created_at            timestamptz not null
  updated_at            timestamptz not null

blog.tags        id, slug unique, name
blog.post_tags   post_id, tag_id  (composite pk)
blog.media       id, storage_key, url, mime, bytes, width, height, alt
blog.post_authors post_id, user_id
```

Notes that matter:

- **`body_schema_version` is ours, distinct from Editor.js's own `version` field.** Epic
  #74 calls for a versioning strategy; this column is what makes a future migration of
  stored blocks tractable instead of guesswork.
- **`reading_time_minutes` is computed on write**, not on read, so listing pages never
  parse block JSON. `ceil(words / 200)`, minimum 1.
- **Scheduling comes free.** `status = 'published'` with a future `published_at` is a
  scheduled post; the read query filters on `published_at <= now()`. This needed a build
  step under the markdown design.
- Indexes: `(status, published_at desc)` for the archive, and the unique `slug`.

## 6. Content security

This is the section that changed most in risk terms, and it deserves attention rather
than a footnote.

Under the markdown design, content arrived through a reviewed pull request from one of
two people, so the first draft bypassed Angular's sanitizer. **That justification is now
gone.** Content enters through a web form, and Editor.js blocks carry HTML fragments in
their `text` fields. Stored XSS via a compromised or careless admin session is a real
path, not a theoretical one.

Therefore:

- **Sanitise on write, server-side**, with an allowlist over the block payloads — the
  inline tags Editor.js actually produces (`b`, `i`, `a`, `code`, `mark`, `br`) and
  nothing else. Rejecting at the boundary means the database never holds hostile markup.
- **Do not bypass Angular's sanitizer on read.** The block renderer emits components per
  block type; inline HTML goes through the default sanitizer. There is no
  `bypassSecurityTrustHtml` anywhere in this design.
- Validate `OutputData` structurally on write against the registered tool set. Unknown
  block types are rejected, not stored and skipped at render.

Belt and braces is the right posture here: the write-side allowlist is the real control,
and the read-side sanitizer is what protects content that predates a future bug in it.

## 7. Rendering blocks

A read-only renderer maps `OutputData.blocks` to Angular components — paragraph,
header, list, quote, image, code, delimiter, table.

**The renderer is not the editor, and keeping them apart is what makes v1 tractable.**
The public site needs only to display blocks; it never needs Editor.js itself, its
toolbar, or its plugins. The editor is admin-only, lazily loaded, and browser-only. That
separation matters directly for SSR: epic #69 exists because Editor.js touches `window`
at import time, and a public page that never imports it cannot crash the server renderer.

Unknown block types render nothing in production and a visible placeholder in
development, so a tool added to the editor before the renderer supports it fails loudly
where it should and silently where it must.

## 8. Routes

| Path             | Page                                        | Rendering |
| ---------------- | ------------------------------------------- | --------- |
| `/`              | Home: intro, latest 6 posts, newsletter CTA | SSR       |
| `/blog`          | Paginated archive, 10 per page              | SSR       |
| `/blog/page/:n`  | Archive page n                              | SSR       |
| `/blog/:slug`    | Post detail                                 | SSR       |
| `/blog/tags`     | Tag index with post counts                  | SSR       |
| `/blog/tag/:tag` | Tag archive                                 | SSR       |
| `/contact`       | Existing contact form                       | SSR       |
| `/admin/**`      | Authoring area                              | Client    |
| `**`             | Not found                                   | SSR (404) |

The current `''` → `/contact` redirect goes; home becomes a real page.

**404s** use a native Angular `**` route, per review. Because rendering is per request,
the SSR layer can set an actual 404 status rather than serving a 200 with error content
— which was not possible under static output and is a genuine advantage of this change.

`/admin` is client-rendered and `noindex`. There is nothing to server-render behind a
login and no SEO value in trying.

Caching: SSR responses for published content get a short `s-maxage` with
`stale-while-revalidate`, invalidated on publish. Without this, every request re-renders
and re-queries for content that changes a few times a week.

## 9. Authoring

Admin area at `/admin`, behind authentication.

- **Auth**: Better Auth with `@anarchitects/better-auth-typeorm-adapter` (0.1.1,
  published). Two accounts, email and password, no public registration — the sign-up
  path is disabled rather than merely unlinked.
- **Editor**: Editor.js in an Angular wrapper, dynamically imported inside an
  `isPlatformBrowser` guard, per epic #69.
- **Tools**: header, list, quote, image, code, table, delimiter, link. Registered
  through one place, which is the shape epic #70 describes.
- **Media**: uploads through an adapter interface (epic #72) so the storage target is a
  configuration choice. Local disk in development; object storage in production — **the
  bucket and credentials are an open question for Johan**, since nothing in this repo
  provisions them.
- **Workflow**: save draft, preview as rendered, publish, schedule, unpublish.
- Preview renders through the same block renderer as the public site. Two renderers that
  drift is the classic failure here.

## 10. Editor.js packages — deferred to Phase B

Community epics #66–#74 define nine packages. **None are published; `packages/` in the
community repo currently holds `better-auth`, `governance` and `nest` only.**

That looked like it blocked the blog. It does not, because of what the epics actually
cover: **not one of them covers read-only rendering.** All nine concern editing —
instance lifecycle (#67), reactive forms (#68), SSR-safe editor usage (#69), the tool
registry (#70), tool wrappers (#71), uploads (#72), custom tools (#73) — plus core
typings (#66) and persistence patterns (#74). The single mention of rendering, in #67,
is the editor rendering inside an Angular app.

**Phase A therefore has no overlap with the epics at all.** Displaying stored blocks on
a public page is this app's own concern, and the question of which repository owns the
editor integration only becomes live at Phase B.

When it does, the answer is: **build app-local behind the §4 contract, extract once
stable.** It is how `@anarchitects/nest-angular-ssr` and the forms packages came about,
and `INTERACTIONS.md` in `anarchitecture-meta` explicitly warns against community
becoming "an undocumented dumping ground" — extraction with a proven consumer is the
guard against that. Concretely: keep the editor wrapper, tool registry and upload
adapter in `libs/frontend/editorjs-*` with no fitoverforty-specific imports, so
extraction is a move rather than a rewrite.

Two epics touch Phase A, and in both cases this app supplies rather than consumes: #66
wants canonical typings and validation helpers, which §4 and §6 define concretely; #74
wants a persistence and versioning strategy, which `body_schema_version` and the §5
storage model are a worked example of. Both are worth contributing back once proven.

`editorjs-html` on npm is deliberately not used. It turns blocks into an HTML string,
which puts us straight back to bypassing Angular's sanitizer — the exact thing §6
removes. Eight block components is a small price for keeping the sanitizer on.

## 11. UI and styling

The direction is unresolved — Johan is reconsidering the `@anarchitects` UI packages and
weighing Tailwind v4 with those packages wrapping it for defaults and consistent
configuration.

**This does not block Phase A, because the block renderer commits to semantics rather
than styling.** It emits `<h2>`, `<figure>`, `<blockquote>`, `<pre><code>`, `<ul>` and
so on, with structural class hooks and no visual opinion. Semantic markup is the
substrate under either outcome, so the styling decision collapses into one later pass
instead of gating step 4.

**Fallback if the decision has not landed by then:** use the existing three-tier custom
property system. It is already wired, already themed, and already works.

Note that `CLAUDE.md` currently states "No Tailwind, no SCSS" as fact. If Tailwind v4
wins, that line and the styling section around it need updating in the same change.

`libs/frontend/blog` remains the home for post cards, archive layout, prose typography,
tag chips and pagination, following the existing header/footer conventions.

## 12. SEO, feed and newsletter

**SEO** — per route: `<title>`, meta description, canonical, OpenGraph, Twitter card,
and JSON-LD `BlogPosting` on post pages. All rendered server-side. `sitemap.xml` is
generated from the database rather than a build step, and `robots.txt` disallows
`/admin`.

**RSS** — `/blog/feed.xml`, RSS 2.0 with `<atom:link rel="self">`, the 20 most recent
published posts. Item descriptions rather than full bodies: lighter, and it keeps
readers arriving on pages that carry the newsletter CTA. Served by the backend from the
same query the archive uses, cached alongside it.

**Newsletter** — unchanged from the reviewed draft. `POST /api/newsletter/subscribe`
behind a `SubscriberPort` with a `MailerLiteSubscriberAdapter`; API key server-side only;
honeypot plus per-IP rate limiting.

UK GDPR/PECR obligations, also unchanged and still the only part of v1 carrying legal
risk:

- **Double opt-in** handled by MailerLite — the subscriber is created `unconfirmed` in a
  group configured for double opt-in. That group setting lives in the MailerLite UI, so
  nothing in CI can prove it; worth confirming directly.
- **One-click unsubscribe** handled by MailerLite in campaign emails.
- **Affirmative consent**: an unticked checkbox, separate from any other purpose, linking
  to a privacy policy. **A privacy policy page is therefore a v1 requirement.**
- **Consent recorded locally** in `newsletter_consent` — email, UTC timestamp, source
  URL, IP, and the wording version from `NEWSLETTER_CONSENT_VERSION`. Owning the audit
  trail matters; the ESP's record is not ours if we change provider.

**Decided: the CTA stays a lightweight bespoke component** posting to that endpoint
rather than a `forms-angular` render. Prerendering was the original argument and it has
gone, but the CTA sits on every page with a single field, and double opt-in plus consent
versioning is not what `forms-nest` models today. The server side still mirrors the
`forms-nest` `delivery` shape, so this collapses into a subscriber delivery target if
one is ever added.

Environment: `MAILERLITE_API_KEY`, `MAILERLITE_GROUP_ID`, `MAILERLITE_API_URL`,
`SITE_URL`, `NEWSLETTER_CONSENT_VERSION`, plus auth and storage variables from §9.
Unlike the mailer gotcha in `CLAUDE.md`, these **fail fast at boot** when the feature is
enabled and the key is missing.

## 13. Testing and CI

- **Backend unit**: sanitisation allowlist (including hostile payloads), `OutputData`
  structural validation, reading-time calculation, slug uniqueness, scheduled-post
  filtering.
- **Backend e2e** (Jest): post CRUD behind auth, unauthenticated writes rejected, draft
  invisible on public endpoints, scheduled post appearing only after its time, newsletter
  subscribe against a faked `SubscriberPort` — no live MailerLite in CI.
- **Frontend unit** (Vitest): block renderer per block type, unknown block handling.
- **Playwright**: archive to post navigation, tag filtering, feed well-formedness,
  newsletter happy path, admin login and publish round trip.
- **CI SSR assertion**: request a post route and assert the response body contains the
  post title as text, and that an unknown slug returns a real 404 status. This is both
  the check that catches a silent regression to client-only rendering and the CI gap
  #501 already identifies.

## 14. Phasing

The scope increase makes a single v1 milestone unrealistic. Two phases, where **Phase A
is a complete public blog with no authoring UI**:

**Phase A — the public site**

1. `content-model` lib; `blog` schema, entities and migrations.
2. Backend read API and the DB-backed `ContentSource`; sanitisation and validation on
   write, exercised by a seed path.
3. Block renderer, routes, SSR wiring, 404 handling, CI SSR assertion.
4. Tags, RSS, sitemap, SEO metadata, JSON-LD.
5. Newsletter, consent persistence, privacy policy page.

**Steps 1 and 2 are unblocked** — no dependency on Johan, on the epics, or on the
styling decision. Step 3's SSR wiring can run in parallel with them, since it touches
the build and the backend rather than the content model.

Content during Phase A is seeded as `OutputData` JSON through a migration or a small
CLI, exactly as the contact form config is seeded today. It is a stopgap and reaches the
same tables the admin will later write to, so nothing is thrown away.

**Phase B — authoring**

6. Better Auth wiring, admin shell, route guards.
7. Editor.js Angular wrapper, SSR-safe, with the tool registry.
8. Media upload adapter and storage.
9. Publish, schedule, preview and unpublish workflow.

Phase A is publishable on its own. Phase B is what makes it pleasant. Splitting them
means the blog is not gated on nine community epics, and §10's recommendation is what
keeps Phase B extractable afterwards.

## 15. Out of scope

Full-text search, comments, related posts, author profile pages, series, i18n,
multi-author roles beyond the two accounts, revision history, and the shop. Named so
they read as deferred rather than forgotten.

Revision history is the one most likely to be regretted — `body_schema_version` and a
`jsonb` column make it cheap to add later, but only if nobody designs around its absence.

## 16. Open questions

Most of the previous revision's open items are resolved above. What remains:

1. **UI direction (§11).** Tailwind v4 wrapped by `@anarchitects` packages, or the
   current three-tier token system. Mitigated — the semantic renderer defers it to a
   single styling pass, with the existing system as the fallback.
2. **Media storage target and credentials.** Phase B only. Phase A ships hero images as
   committed frontend assets; the `MediaStoragePort` gets a local-disk adapter and the
   production provider is a configuration swap.
3. **MailerLite double opt-in group configuration.** Lives in the MailerLite UI, not in
   this repo, and nothing in CI can verify it. Needs whoever holds the account.

### Resolved since the last revision

- **§10, app-local or community-first** — deferred to Phase B; no epic covers rendering,
  so Phase A is unaffected.
- **#7's loose ends** — not a decision but scheduled work: Nx `dependsOn` for build
  ordering, a documented dev/prod topology, and a CI check that boots and asserts a
  rendered response.
- **Newsletter CTA** — stays bespoke (§12).
- **Pagination** — 10 per page.
- **404 handling** — native Angular `**` route, returning a real 404 status.

## 17. Reference

- Editor.js epics: community #66–#74
- SSR integration findings: community #501
- Ecosystem roles and cross-repo rules: `anarchitecture-meta` (private)
