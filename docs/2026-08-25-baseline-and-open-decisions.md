# Baseline and open decisions — 25 August 2026

**Disposable.** This exists to feed the spec. Once the spec lands, fold anything
still relevant into it and delete this file. Durable facts about working in the
repo belong in `CLAUDE.md`, not here.

## Where things already live

Do not restate these — they have canonical homes and will drift if copied.

| Topic                                                 | Where                              |
| ----------------------------------------------------- | ---------------------------------- |
| Working in this repo: commands, architecture, gotchas | `CLAUDE.md`                        |
| SSR integration findings, five workarounds, analysis  | community issue #501 (public)      |
| SSR spike implementation and its known gaps           | PR #7 (draft)                      |
| Why each spike workaround was necessary               | commit message on the spike commit |
| Package composition and layering rules                | `AGENTS.md`, `README.md`           |

## Baseline state

`main` carries four merged PRs from this session. Local dev works from a clean
clone: `docker compose up -d` then `nx serve fitoverforty-frontend`, with
`env.example` now documenting database _and_ mail. CI is green and manually
dispatchable. The backend e2e migration race is fixed and verified against fresh
databases. All `db:*` TypeORM CLI targets work.

The contact form works end to end — renders from its database config, persists,
and delivers both the admin notification and the autoreply.

## Decided

- **ESP: MailerLite.** Not yet integrated. The form currently emails and
  persists; it does not subscribe anyone to a list.
- **Shop: Stripe**, third-party checkout rather than anything self-built.
- **Hosting:** handled outside this repo.
- **Content: markdown-in-repo first.** Both authors are technical, it ships
  fastest, and it prerenders well. No CMS, no posts table, no auth needed to
  publish.

## The one architectural constraint worth honouring

Keep the content **source** behind a narrow contract and build the rendering
layer against that. Post list, post detail, tags, pagination and reading time do
not care whether a post arrived as markdown frontmatter or Editor.js
`OutputData`.

This matters because the org has open epics for `@anarchitects/editorjs-core`
(community #66) and Editor.js persistence patterns (#74) — intent, but no
published package and nothing in the community repo's `packages/`. If Editor.js
later becomes the content direction, a source swap should not mean redesigning
the UI layer. Cheap now, expensive to retrofit.

## Package candidates, in the order they look worth extracting

1. **Content rendering** — the layer above. No `@anarchitects` content package
   exists, so this app is where the shape would be discovered.
2. **ESP / subscriber port** — `forms-nest` already models `delivery`
   (`adminEmail`, `autoReply`) in the form config. "Also subscribe this address"
   is an extension of that shape rather than a new subsystem.
3. **Stripe — deliberately not a package.** Payment Links are configuration and
   markup; little abstraction worth owning and financial failure modes. Keep it
   app-level.

## Open for the spec

- SSR: PR #7 proves the split-workspace approach works but is not
  production-wired. Build ordering, the dev/prod topology split, and CI
  asserting a rendered response are unresolved. Worth settling before the
  content model is built on top.
- Whether the blog's routes are prerendered, server-rendered per request, or a
  mix — the SSR package renders per request; content is static.
- MailerLite consent flow: double opt-in and one-click unsubscribe are UK
  GDPR/PECR obligations, and the current form has neither.

## Small things worth doing whenever

- Declare a named volume for Postgres in `docker-compose.yml`. There is none, so
  `docker compose down` silently destroys the local database.
- Nx Cloud workspace `69c55480ee9de4adf5c7a1d0` was provisioned in March and is
  connected to nothing; `nx.json` has no `nxCloudId`. Reuse that ID rather than
  creating a second workspace.
- TypeORM runs with `logging: true`, so every query lands in CI output and makes
  logs hard to search.
