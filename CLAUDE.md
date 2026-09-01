# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## Commands

Always run tasks through Nx, prefixed with the package manager. **`yarn` on PATH may be
Yarn 1** — the workspace pins Yarn 4 via `packageManager`, so use `corepack yarn` for
anything that resolves dependencies. Running `yarn install` with Yarn 1 against this
Berry-format lockfile will misbehave.

```bash
corepack yarn install --immutable        # same as CI
corepack yarn nx run-many -t lint test build e2e   # what CI runs
corepack yarn nx run-many -t lint
corepack yarn nx run fitoverforty-backend-e2e:e2e  # backend e2e (Jest)
corepack yarn nx run fitoverforty-frontend:test    # frontend unit (@angular/build:unit-test)
corepack yarn nx run fitoverforty-frontend-header:test   # lib unit (Vitest)
corepack yarn nx run fitoverforty-frontend-e2e:e2e       # Playwright
```

The backend e2e suite needs Postgres running (`docker compose up -d db`) — without it,
`globalSetup` fails with a bare `AggregateError` that does not mention the database.

Single test: Vitest libs take `-t <name>`; Jest e2e takes a path filter.

```bash
corepack yarn nx run fitoverforty-frontend-header:test -- -t "renders the app title"
corepack yarn nx run fitoverforty-backend-e2e:e2e -- contact-form-flow
```

CI can be triggered manually: `gh workflow run ci.yml --ref <branch>`.

## Running the app locally

**Docker is a development convenience only.** A deployed blog runs against a dedicated
Postgres instance on the host server; nothing in `docker-compose.yml` is a production
artefact, and it should not be reasoned about as one.

Both services are required. `nx serve fitoverforty-frontend` starts the backend too via
`dependsOn`, and proxies `/api` to `:3000`.

```bash
docker compose up -d db mailpit
corepack yarn nx serve fitoverforty-frontend   # :4200, backend on :3000
```

Copy `apps/fitoverforty/backend/env.example` to a `.env` at the **workspace root** — that
is where `ConfigModule` reads from, not the backend directory.

Mailpit's web UI is at http://localhost:8025.

## Architecture

An Nx monorepo whose app is a thin host over published `@anarchitects/*` packages. The
design system, UI primitives, layouts and the entire forms stack come from npm; very
little domain code is local. Read those package READMEs before wiring anything — see the
Bricks overlay rules in `AGENTS.md` and `.github/copilot-instructions.md`.

- **Frontend** (`apps/fitoverforty/frontend`) — Angular 22, standalone, client-rendered.
- **Backend** (`apps/fitoverforty/backend`) — NestJS 11 on **Fastify** (not Express,
  despite `platform-express` also being installed), bundled by webpack to CommonJS.
- **Libs** (`libs/<domain>/<platform>[/<layer>]`) — see Conventions; Vitest for the
  Angular and TypeScript ones, Jest for the Nest ones.

### The contact form is configuration, not code

The only feature. Its fields, labels, validation, admin email and templates live in a
**database row**, seeded by a migration
(`backend/tools/typeorm/migrations/*-ContactForm.ts`). The frontend route passes only
`formId` and lets `@anarchitects/forms-angular` fetch and render it; the backend routes
come from `FormsModule`. Changing the form means writing a migration, not editing a
component.

Forms tables live in the **`forms` schema**, not `public` — queries scoped to `public`
will appear to show a broken database.

### Styling

**Tailwind v4 over a three-tier token system, not instead of it.** No SCSS. The tiers are
unchanged: `--anx-ref-*` raw palette → `--anx-sys-*` semantic tokens → `.anx-*` class
hooks, switching on `.anx-root[data-anx-theme][data-anx-surface]` from
`provideDesignSystemConfig()`. CSS logical properties throughout. Never hardcode a colour
outside `frontend/src/styles/themes.css`.

Tailwind's theme is defined **entirely in terms of those tokens** in
`frontend/src/styles.css`, so `bg-surface` and a hand-written `.anx-*` rule cannot
disagree. Adopted per Johan's answer on #52: the `@anarchitects` UI packages do not wrap
Tailwind yet, so this app takes it directly and migrates when they ship.

Semantic classes stay where they are. `.blog-*` and `.admin-*` are written out in
`styles/blog.css` and `styles/admin.css` rather than being replaced by utility soup in
templates — utilities are for new work, not for rewriting what already reads well.

**Light and dark switch on `data-anx-theme`, never on `data-anx-surface`.** The design
system defines `surface` as `['plain', 'card']` and means *chrome* by it — `plain` is
what makes `.anx-surface` borderless, which `styles/forms.css` has to work around.
`theme` is free-form (the package ships no `ANX_THEMES`). The theme blocks were
originally keyed on `[data-anx-surface='plain']` and `[data-anx-surface='dark']`, which
conflated the two axes: going dark also moved the app to a surface value the package does
not define, silently changing borders as a side effect of changing colour. A unit test
asserts `ThemeService` never writes `data-anx-surface`.

An inline script in `index.html` applies the theme before first paint. It has to be
inline and synchronous — anything deferred paints light first and flashes. SSR always
renders the light attribute, because the server cannot know the preference; the script
corrects it during head parsing, before the body renders. The design system's own DOM
sync only writes the attribute when it is absent, so the script wins without fighting it.

**The `@anarchitects` packages do ship CSS, and it is easy to conclude they do not.**
There is no `.css` file anywhere in any of them — the styles are Angular component styles
compiled into the JS bundles, so searching the packages for stylesheets finds nothing.
They include *global* rules such as `.anx-root .anx-action` and
`.anx-root[data-anx-surface='plain'] .anx-surface`, at two and three classes of
specificity respectively.

That is why `styles/forms.css` leads every selector with `.anx-root`. A selector like
`anarchitects-forms-feature-form .anx-surface` is one class and two elements, loses to the
package's own rule, and fails in the worst way available: the rule is present in the
stylesheet, matches the element, and visibly does nothing. If a rule against an
`@anarchitects` component appears to be ignored, count specificity before assuming the
selector is wrong.

## Related repositories

This app **consumes** the Anarchitects ecosystem but is not a member of it — it appears
in no ecosystem catalogue. Three repos govern what it consumes:

| Repo                                                                                         | Visibility | What it answers                                                                              |
| ---------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| [`anarchitecture-meta`](https://github.com/anarchitects/anarchitecture-meta)                 | private    | Repository roles, cross-repo dependency rules, ecosystem-level architecture positions        |
| [`anarchitecture-community`](https://github.com/anarchitects/anarchitecture-community)       | public     | The `@anarchitects/*` packages this app depends on, and epics for ones that do not yet exist |
| [`anarchitecture-bricks-3tier`](https://github.com/anarchitects/anarchitecture-bricks-3tier) | public     | The 3-tier brick model: layering, naming and library entry-point conventions                 |

**All three are cloned as siblings of this repo**, at `../anarchitecture-*`. Read them
there rather than working from memory — that is why they were cloned. Re-clone with
`gh repo clone`, not plain `git clone`: the private one fails over HTTPS with a
misleading `Repository not found`.

`anarchitecture-bricks-3tier` documents the brick model, but note its own stated scope:
it is the home of publishable bricks and reference implementations, explicitly **not**
of end-user applications. Its layering and entry-point conventions are the thing to
follow here; its repository layout is not a template for this app's.

Consult `anarchitecture-meta` before deciding **where** code should live — this app, a
community package, or a plugin. Start with `README.md`, `ECOSYSTEM-MODEL.md`,
`INTERACTIONS.md` and `AI-ENABLEMENT.md`; `adr/` carries the reasoning behind them.

Two things that cost time otherwise:

- **Private repos need `gh repo clone`.** Plain `git clone` over HTTPS has no credentials
  and fails with a misleading `Repository not found`, as though the name were wrong.
- **An epic in the community repo is intent, not a package.** `packages/` there currently
  holds only `better-auth`, `governance` and `nest`. Check npm before designing against
  an `@anarchitects/*` name that only appears in an issue.

## Reference material

Johan supplied **Manfred Steyer's _Modern Angular_ (v2.0.0, June 2026)** as the guide he
has his AI follow when building Angular apps. It sits **outside every repository**, at
`../supplemental-documents/reference/`, next to `modern-angular-index.md`.

Read the index first, not the PDF. The book is 467 pages, `Read` takes at most 20 at a
time, and **PDF page = printed page + 12** — the index carries both numbers per chapter
plus a table mapping the sections that bear on this app (vertical slicing and Sheriff in
ch. 8, Nx module boundaries in ch. 14, SSR and hydration in ch. 17, Vitest in ch. 7).

The book targets **Angular 22**, and so does this app since the Nx 23 migration — the
version caveat that used to sit here is gone, and Steyer's Angular-22-only notes now
apply directly rather than needing to be read around.

One caveat remains: it is a purchased commercial ebook. It stays out of git, and its
text does not get copied into repo documentation. Cite chapter and page.

`../supplemental-documents/fitoverforty/` holds the meeting notes that produced the
current work, on the same footing: shared context, deliberately untracked.

## Gotchas

These cost real debugging time; none are inferable from the code.

- **Mailer env is required or submissions half-fail.** Every `MAILER_*` value has a
  placeholder default (`smtp.example.com`), so unset does not mean disabled — the app
  boots and fails at send time with `ECONNREFUSED`, _after_ persisting the submission.
- **`PORT` collides.** `backend/src/main.ts` reads `process.env.PORT`. A launcher that
  exports `PORT=4200` for the frontend makes Nest try to bind 4200 and die with
  `EADDRINUSE`. `.claude/launch.json` wraps the dev server in `env -u PORT`.
- **Absolute paths in the root `.env` do not survive moving the workspace**, and the
  three that matter fail in two different ways. `WEB_SERVER_ENTRY` and
  `WEB_BROWSER_ASSETS_DIR` are read by `registerSsr()`, which runs *before*
  `app.listen()` in `main.ts` — so a stale path throws during bootstrap and the backend
  never binds at all. The only visible symptom is `ECONNREFUSED` from the Vite proxy on
  every `/api` call, which reads as "the backend is slow to start" and mentions neither
  `.env` nor SSR; the real `Cannot find module` sits one line among hundreds of proxy
  retries. `MAILER_TEMPLATE_DIR` is worse, because it is read by
  `@anarchitects/common-nest-mailer` at send time — so the app boots clean and fails
  only when someone submits the contact form, after the submission is persisted, per the
  mailer gotcha above. Note `env.example` recommends an absolute path for it, which is
  sound advice against a shifting working directory and precisely what breaks on a move.
  Prefer relative paths, and re-check all three after relocating the repository.
- **The root `tsconfig.json` exists for ts-node.** The `@anarchitects/nx-typeorm`
  executors spawn the TypeORM CLI from the workspace root; without a root tsconfig,
  ts-node falls back to `module: node16`, emits ESM, and every `db:*` target fails to
  load the data source. The backend's own `ts-node` block is never discovered from there.
- **A backend-e2e suite must only delete rows it created, by prefix.** The suites share
  a database with the seeded blog content, and `blog.tags` is where that bites: writing
  a test that tags a post "Recovery" and then cleans up `WHERE slug = 'recovery'`
  deletes the *seeded* tag, and the failure lands on three assertions in two other
  suites that never mentioned it. `publish-workflow.spec.ts` prefixes everything it
  creates and deletes by `LIKE 'e2e-publish-%'`; do the same.
- **backend-e2e runs one suite at a time, and must.** The suites share a database and
  assert on global state — how many posts the archive holds, how many published posts
  carry each tag — so a suite that publishes something breaks a different suite that is
  merely counting. That was accidentally safe until Phase B step 9 added a suite that
  writes: a two-core CI runner makes Jest's default `cores - 1` equal one, so a bigger
  runner would have broken CI with no code change. `maxWorkers: 1` in
  `backend-e2e/jest.config.cts` states it. `testTimeout` is raised there too, because
  every suite boots a whole Nest app and five seconds is not a budget for that.
- **e2e migrations still run once in `globalSetup`**, not per suite, and should stay
  there even now that workers are serial: `runMigrations()` per suite would re-check the
  whole migration table on every file for no benefit, and the original race it avoided
  returns the moment anyone raises `maxWorkers` again.
- **`docker compose down` destroys the local database.** Postgres data sits on an
  anonymous volume, so `down` takes it with the container. Use `stop`. Do **not**
  "fix" this by declaring a named volume: Docker here is a development convenience
  only, and a deployed blog runs against a dedicated Postgres instance on the host
  server, so the compose file has no production role to protect.
- **`gh pr edit` fails** on the installed `gh` (deprecated Projects-classic GraphQL).
  Use `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -F body=@file` instead.
- **`BETTER_AUTH_SECRET` and `SITE_URL` are both required or the backend will not boot.**
  Unlike `MAILER_*` neither has a placeholder default, on purpose. A known signing secret
  means anyone who can read this repository can mint an admin session. `SITE_URL` is the
  *sole* entry in Better Auth's `trustedOrigins` and the base for session cookies, so a
  development default would leave a deployed instance trusting `http://localhost:4200` to
  drive the admin login for ever — which is exactly what it did until the unconditional
  seed was removed. Anything that boots the backend needs both: your root `.env`, CI's
  workflow env, the SSR check's spawn env, and `apps/fitoverforty/test-stubs/env.cjs` for
  the Jest suites, all set them separately. Note the *frontend's* `SITE_ORIGIN` and
  `blog-nest`'s `siteOrigin()` still fall back to the request when it is unset — they run
  in places where it legitimately can be — so the requirement is the auth path's, not a
  workspace-wide invariant.
- **Better Auth's tables use camelCase column names, and must.**
  `@anarchitects/better-auth-typeorm-adapter` resolves joined rows by TypeORM property
  name; a column renamed with `name: 'provider_id'` is silently dropped from the joined
  projection. That breaks sign-in specifically — it loads the user together with its
  accounts, then matches on `providerId` — and fails as "User not found" while the row
  sits correctly in the table. The rest of the repo is snake_case; `auth` is not.
- **Better Auth is pinned to `~1.6.30`, on purpose.**
  `@anarchitects/better-auth-typeorm-adapter@0.1.1` accepts `better-auth: ^1.0.0` as a
  peer but was built and validated against < 1.7, so the wider range is not a promise.
  1.7 added `accounts.issuer` and scopes account identity by it; the adapter does not
  know the field. Unpin only when an adapter supporting 1.7 ships — tracked at
  anarchitecture-community#509 — and restore `accounts.issuer` to NOT NULL when you do.
- **Better Auth's field list comes from the library, not the adapter's README**, and the
  import path moved. On the pinned 1.6 line it is `getAuthTables({})` from
  `better-auth/db`; `@better-auth/core` does not exist before 1.7. Ask the library rather
  than the README, which omits `issuer` entirely. That list is also how you tell whether
  a column is written at all: on 1.6 `account` has no `issuer`, which is why the column
  is nullable.
- **Block types live in `@fitoverforty/content-model` and three places consume them.**
  `SUPPORTED_BLOCK_TYPES` is read by the write-side validator, the public renderer and
  the editor's tool registry. The dangerous drift is the editor offering more than the
  validator accepts — an author writes a whole post and finds out at save time — so a
  test in each direction guards it. Editor.js's list tool ships a checklist style the
  contract does not allow and offers no way to configure it off; the registry subclasses
  the tool to filter its toolbox instead.
- **`AdminGuard` cannot pass in the backend Jest suites without an override.** The
  Better Auth stub throws, so every guarded route answers 500 rather than anything
  meaningful — which would leave the authoring API, the part that most wants a real
  database, untestable. `createFastifyTestApp({ signedInAs })` in `backend-e2e`
  overrides `AUTH_INSTANCE` with a session; `signedInAs: null` overrides with no
  session, which is how a test asserts 401 rather than 500. Omitting the key leaves the
  stub in place.
- **The newsletter webhook replaces Fastify's global JSON parser.** Signature
  verification is over the raw bytes — `JSON.stringify(JSON.parse(x))` is not
  `x`, so an HMAC over the reparsed object rejects every genuine delivery — and
  Fastify parses JSON before any handler runs. `RawBodyParser` therefore calls
  `removeContentTypeParser('application/json')` and installs its own, which
  behaves identically but keeps the raw string on the request. Two consequences:
  `addContentTypeParser` alone throws "already present" because Nest's adapter
  registered one during bootstrap; and a bug there breaks **every** JSON route in
  the app, which is why `newsletter-webhook.spec.ts` asserts that ordinary POSTs
  still parse. It is wired from `NewsletterModule`, not `main.ts`, because
  backend-e2e never compiles `main.ts` — the same trap that hid the
  `@fastify/multipart` types in step 8, and signature verification is the last
  thing that should be untestable. It is also deliberately *not* scoped to the
  webhook's path: matching one meant hard-coding the `/api` global prefix, which
  the e2e app does not set, so the check failed open there.

- **Four things about the Tailwind wiring are non-obvious, and three fail silently.**
  - **`.postcssrc.json` lives at the workspace root, not the project root.** Angular
    searches `[projectRoot, workspaceRoot]`, but `frontend/project.json` declares no
    `root`, so the project-level lookup never resolves and a config placed beside the app
    is simply ignored — with no warning, and the build failing as though Tailwind were
    not installed. Verified by putting a bogus plugin name in each location: only the
    workspace-root file produced `Cannot find module`.
  - **`@import 'tailwindcss/index.css'`, never `@import 'tailwindcss'`.** Angular's
    esbuild resolves CSS `@import` *before* PostCSS runs, so the bare specifier never
    reaches Tailwind's plugin — and esbuild cannot resolve it either, because the package
    exports `.` only under the `style` condition. The error is
    `Could not resolve "tailwindcss"`, which reads like a missing dependency.
  - **`@source '../../../../libs'` is required.** Automatic content detection walks out
    from the CSS file and therefore only ever sees the app. Every component that emits a
    class lives in `libs`, so without it their utilities are never generated: the class
    is in the DOM and no rule exists. Nothing errors.
  - **`@theme inline` is load-bearing, not a style preference.** Plain `@theme` emits
    `var(--color-surface)`, which resolves where it was *defined* — at `:root` — freezing
    every utility on the light theme. `inline` emits `var(--anx-sys-color-surface)`,
    resolved at the point of use, inside whichever `data-anx-surface` is active. Dropping
    it breaks theme switching and nothing fails.

- **Tailwind's preflight removes what the blog was relying on.** Before Tailwind, no rule
  anywhere matched the 31 `blog-*` classes the renderer emits — posts rendered on browser
  defaults. Preflight strips those too (list markers, heading sizes), so adding Tailwind
  without writing `styles/blog.css` in the same change makes the blog *worse*, not
  better. If a heading or list ever looks flattened, check for a class with no rule rather
  than assuming a cascade problem.

- **The TypeORM CLI ignores the data source's `logging` setting.** The app logs
  `['error', 'warn', 'migration']` — successful queries are silent, failing ones
  still print their SQL and parameters, which is what makes a broken migration
  diagnosable. `TYPEORM_LOGGING=all` restores the firehose for a debugging
  session, a comma-separated list of TypeORM's levels picks something between,
  and `false` silences it. But `nx run fitoverforty-backend:db:migrate:*` still
  prints every query whatever you set, because TypeORM's own migration command
  overwrites the option with `["query","error","schema"]` after loading the data
  source. That is upstream behaviour, not a mistake here — do not "fix" it by
  editing `data-source.ts`.

- **A migration must never save through an entity.** Entities mean whatever HEAD
  says today; a migration has to mean the same thing forever. `SeedBlogContent`
  saved through `AuthorEntity`, so adding `authors.user_id` in a *later*
  migration broke that *earlier* one — the entity gained the column, the insert
  started naming it, and it does not exist yet at that point in the sequence.
  Because `runMigrations()` wraps the whole set in **one transaction**, the
  rollback left an entirely empty database and the visible failure was
  thousands of lines of `relation "blog.posts" does not exist`, pointing
  nowhere near the cause. It cannot reproduce on a developer machine where the
  migrations are already applied and only the new one runs: **test a new
  migration against a dropped schema**, not against your working database.
  Import constants with the same suspicion — a literal `1` beats
  `CURRENT_BODY_SCHEMA_VERSION`, which is free to move and silently re-label
  content seeded years earlier.

- **Alt text is required to publish a post, not to save one.** Editor.js uploads a file
  before the author has written anything about it, so `blog.media.alt` is empty at
  upload by design and `PostAdminService.publish` is what refuses. Moving the check to
  the draft save would make it impossible to park an unfinished post with an image in
  it.
- **ESM-only packages cannot be loaded by the backend Jest suites at all.** `better-auth`
  and its adapter ship `.mjs` with `"type": "module"`, and `jest-resolve` treats both as
  ESM _before_ any transform runs — so this is not a missing `transformIgnorePatterns`
  entry, and adding one will not help. They are mapped to deliberately-loud stubs
  instead; see `apps/fitoverforty/test-stubs/README.md`. Node 24 loads them fine via
  `require(esm)`, which is why the built server works and why real sign-in is covered by
  Playwright rather than Jest.

## Known rough edges

Not defects, but worth knowing before you trip over them or duplicate the work.

- **Nx Cloud is connected, so a green run may not have run anything.** `nx.json` carries
  `nxCloudId: 69c55480ee9de4adf5c7a1d0` — the workspace created in March, reused rather
  than letting `nx connect` mint a second one. Every cacheable target now reads and
  writes the remote cache, which means a passing `nx run-many` locally can be entirely
  cache hits from CI. That is the point of it, but it makes "I ran the tests" a weaker
  claim than it was: use `--skipNxCache` when you need to know the code actually
  executed, as the Nx 23 migration's own validation did.

## Conventions

- Angular v21 suffix-less naming in apps (`app.ts`, `app.config.ts`); libs use the older
  `*.component.ts`. Match the surrounding context.
- **Libs are moving to a domain layout**: `libs/<domain>/{angular,nest,ts}`, project
  `fitoverforty-<domain>-<platform>`, alias `@fitoverforty/<domain>-<platform>`. `seo` is
  the first; the older flat `libs/frontend/<name>` libs (`header`, `footer`, `blog`,
  `editorjs`) have not moved yet, so both shapes exist — match the domain layout for
  anything new.
- **Libs stay non-buildable, deliberately** (`test` and `lint` targets only, consumed as
  source through the tsconfig alias). The bricks repo's layered entry points —
  `config`, `data-access`, `feature`, `state`, `ui` — are an ng-packagr feature needing
  publishable libraries, and this app publishes nothing. Johan confirmed the plain
  `index.ts`; see issue #34. A consequence: `@nx/angular:library` refuses
  `--unitTestRunner=vitest-angular` on a non-buildable lib, so generate with `none` and
  copy the `@nx/vitest:test` target and `vite.config.mts` from an existing lib.
- **The frontend restructure is complete**, and the backend is under way. Every lib is
  `libs/<domain>/<platform>[/<layer>]`. **The restructure is finished.**
  `apps/fitoverforty/backend/src` now holds only the composition root — `app`,
  `data-source.ts`, `main.ts`, `ssr` — and no domain code or tests. If you are adding a
  backend feature, it belongs in a `libs/<domain>/nest`, not here.
- **A Nest lib gets its Jest config by hand**, not from the generator: `@nx/nest:library`
  with a unit test runner writes a root `jest.preset.js` and `jest.config.ts` this
  workspace does not use. Generate with `--unitTestRunner=none` and copy
  `libs/newsletter/nest/jest.config.cts`, which points at `apps/fitoverforty/jest.shared.cjs`.
- **`jest.shared.cjs` derives its aliases from `tsconfig.base.json`.** Do not restate them
  by hand. A moved library that is not mapped fails as `Cannot find module` reported
  against `data-source.ts` — which points at the importer, not the mapping, and reads like
  a broken move rather than a missing alias.
- `libs/blog/ts` is the shared contract library — what bricks calls a domain contract lib —
  and is the one thing imported by **both** the backend and the frontend. It was
  `@fitoverforty/content-model`; the Jest moduleNameMapper in `apps/fitoverforty/jest.shared.cjs`
  points at it by path, so moving it means editing that too.
- `libs/common/angular/ui` holds the page chrome (header, footer). `common` is not a domain;
  it is where shared platform UI goes, following `libs/common/angular/*` in bricks.
- `libs/editorjs/angular` is deliberately top-level rather than under `admin`: it imports
  nothing fitoverforty-specific and is the extraction candidate if a second consumer appears.
- **A domain splits by how it is imported, not by file count.** `admin` needs two projects
  (`feature`, `data-access`) and `blog` three; `seo`, `newsletter` and `legal` are single
  projects because nothing in them is lazily routed. Add a project only when the boundary
  is real.
- **A domain with routed pages splits into three projects**, as `blog` does:
  `libs/blog/angular/{feature,ui,data-access}`. One project cannot be both
  lazy-loaded and statically imported — `@nx/enforce-module-boundaries` rejects it, and
  it is right to: pages are reached by lazy `import()`, while the renderer (the admin
  editor previews with it) and the HTTP wiring (`app.config` needs it) are static. The
  names are the bricks entry-point names, as separate Nx projects rather than ng-packagr
  entry points; bricks nests projects this way too, under `libs/common/angular/*`.
- **Lazy routes address a page module directly, never the barrel.** `app.routes.ts`
  imports `@fitoverforty/blog-angular-feature/home.page` through a wildcard path alias.
  A dynamic `import()` of a barrel pulls every page into one chunk, and a single static
  import of it drags the whole lib into the initial bundle — measured at 23.7 kB raw /
  6.1 kB transfer added to first load, with six per-route chunks collapsed into one.
- **`OnPush` is enforced everywhere by lint**, apps included, via
  `@angular-eslint/prefer-on-push-component-change-detection`. The Angular 22 preset
  enables it; the Nx 23 migration disabled it in the frontend and set the root component
  to `Eager` to preserve the old default, and #59 reversed both. So a new component with
  no `changeDetection` fails lint rather than quietly defaulting.
- Lib conventions otherwise unchanged: selector prefix `fitoverforty-`, standalone +
  `OnPush`, exported via `src/index.ts`. **Moving a component out of the app means
  renaming its selector** — lint enforces the prefix in libs but not in apps, so an
  `app-*` selector passes where it is and fails the moment it lands in a lib. Rename it
  and every template that uses it in the same move; `newsletter-cta` went from
  `app-newsletter-cta` to `fitoverforty-newsletter-cta` this way.
- Import `@anarchitects/*` public entry points only, never internal paths.
- Conventional commits. Squash-merge is the repo convention.
- Prettier: single quotes, 2-space.
