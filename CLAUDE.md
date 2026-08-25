# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **e2e migrations run once in `globalSetup`**, not per suite. Jest runs suites in
  parallel workers, and concurrent `runMigrations()` on a fresh database races on the
  migrations table. Do not move them back into `beforeAll`.
- **`docker compose down` destroys the local database.** No named volume is declared, so
  Postgres data sits on an anonymous one. Use `stop`, not `down`.
- **`gh pr edit` fails** on the installed `gh` (deprecated Projects-classic GraphQL).
  Use `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -F body=@file` instead.

## Conventions

- Angular v21 suffix-less naming in apps (`app.ts`, `app.config.ts`); libs use the older
  `*.component.ts`. Match the surrounding context.
- Libs: project `fitoverforty-frontend-<name>`, alias `@fitoverforty/frontend-<name>`,
  selector prefix `fitoverforty-`, standalone + `OnPush`, exported via `src/index.ts`.
- Import `@anarchitects/*` public entry points only, never internal paths.
- Conventional commits. Squash-merge is the repo convention.
- Prettier: single quotes, 2-space.
