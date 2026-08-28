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

- **Frontend** (`apps/fitoverforty/frontend`) — Angular 21, standalone, client-rendered.
- **Backend** (`apps/fitoverforty/backend`) — NestJS 11 on **Fastify** (not Express,
  despite `platform-express` also being installed), bundled by webpack to CommonJS.
- **Libs** (`libs/frontend/{header,footer}`) — presentational only, Vitest.

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

No Tailwind, no SCSS. A three-tier CSS custom property system: `--anx-ref-*` raw palette
→ `--anx-sys-*` semantic tokens → `.anx-*` class hooks. Themes switch on
`.anx-root[data-anx-theme][data-anx-surface]`, driven by `provideDesignSystemConfig()`.
CSS logical properties throughout. Never hardcode a colour outside
`frontend/src/styles/themes.css`.

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

## Gotchas

These cost real debugging time; none are inferable from the code.

- **Mailer env is required or submissions half-fail.** Every `MAILER_*` value has a
  placeholder default (`smtp.example.com`), so unset does not mean disabled — the app
  boots and fails at send time with `ECONNREFUSED`, _after_ persisting the submission.
- **`PORT` collides.** `backend/src/main.ts` reads `process.env.PORT`. A launcher that
  exports `PORT=4200` for the frontend makes Nest try to bind 4200 and die with
  `EADDRINUSE`. `.claude/launch.json` wraps the dev server in `env -u PORT`.
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
- **`BETTER_AUTH_SECRET` is required or the backend will not boot.** Unlike `MAILER_*`
  there is no placeholder default, on purpose: a known signing secret means anyone who
  can read this repository can mint an admin session. Anything that boots the backend
  needs one — your root `.env`, CI's workflow env, and the SSR check's spawn env all set
  it separately.
- **Better Auth's tables use camelCase column names, and must.**
  `@anarchitects/better-auth-typeorm-adapter` resolves joined rows by TypeORM property
  name; a column renamed with `name: 'provider_id'` is silently dropped from the joined
  projection. That breaks sign-in specifically — it loads the user together with its
  accounts, then matches on `providerId` — and fails as "User not found" while the row
  sits correctly in the table. The rest of the repo is snake_case; `auth` is not.
- **Better Auth's field list comes from the library, not the adapter's README.** The
  README documents an older version and omits `accounts.issuer`, which 1.7 made
  required. `getAuthTables({})` from `@better-auth/core/db` is the authoritative list.
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

Deliberately unfixed, and worth knowing before you trip over them or duplicate the work.

- **Nx Cloud is provisioned but wired to nothing.** Workspace
  `69c55480ee9de4adf5c7a1d0` was created in March; `nx.json` has no `nxCloudId`, so no
  target reads or writes the remote cache. If you connect it, reuse that ID — running
  `nx connect` creates a second workspace rather than adopting the existing one.

## Conventions

- Angular v21 suffix-less naming in apps (`app.ts`, `app.config.ts`); libs use the older
  `*.component.ts`. Match the surrounding context.
- Libs: project `fitoverforty-frontend-<name>`, alias `@fitoverforty/frontend-<name>`,
  selector prefix `fitoverforty-`, standalone + `OnPush`, exported via `src/index.ts`.
- Import `@anarchitects/*` public entry points only, never internal paths.
- Conventional commits. Squash-merge is the repo convention.
- Prettier: single quotes, 2-space.
