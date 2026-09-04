# Deploying

Target topology, as stated on #56: a **pm2-managed Node process behind Nginx**,
with a dedicated Postgres on the host. `docker-compose.yml` is a development
convenience and has no role here.

Everything in this directory has been exercised against the built artefact on a
developer machine — the artefact installed standalone, booted, server-rendered
the blog, and answered through a real Nginx using the config below. What has
_not_ been exercised is a machine: no host, no DNS, no certificate. That is
what #65 is still about.

## One artefact, two directories

```
/var/www/fitoverforty-test/          # and /var/www/fitoverforty for production
  ecosystem.config.cjs               # this repo's pm2 file, synced by the deploy
  backend/                           # dist/apps/fitoverforty/backend — main.js,
                                     #   migrate.js, package.json, yarn.lock,
                                     #   .yarnrc.yml, assets/, plus .env and
                                     #   node_modules created on the server
  frontend/
    browser/                         # dist/apps/fitoverforty/frontend/browser
    server/                          # dist/apps/fitoverforty/frontend/server
```

The Node process serves both the rendered pages and the API, so there is one
upstream and one port.

## Build

```bash
corepack yarn nx run-many -t build -p fitoverforty-frontend fitoverforty-backend
```

That is the whole build. The backend's webpack config sets
`generatePackageJson: true`, so `dist/apps/fitoverforty/backend` already
contains a `package.json` listing only runtime dependencies and a `yarn.lock`
pruned to match. There is no separate prune step — there were three such
targets and they had been broken since the Nx 23 migration, which nothing
noticed because they produced files the build was writing anyway.

Two dependencies are declared by hand, in `webpack.config.js` under
`runtimeDependencies`, because they are `require`d by name at runtime and
webpack therefore never sees them: **`pg`**, without which the process dies at
boot with "Postgres package has not been found installed", and **`nodemailer`**,
a non-optional peer of the mailer that resolves in the workspace only because
something else hoists a copy. Anything else loaded dynamically has to be added
there too.

## Install on the server

```bash
cd /srv/fitoverforty/current/server
corepack yarn install --immutable
```

The `.yarnrc.yml` that the build copies into the artefact is load-bearing.
Yarn Berry defaults to Plug'n'Play, and the generated `package.json` carries
`packageManager: yarn@4.x`, so without it `yarn install` writes `.pnp.cjs` and
no `node_modules` — after which `node main.js` cannot resolve its first
`require`. The workspace root sets the linker in its own `.yarnrc.yml`; a
separate install root inherits nothing.

## Environment

`.env` sits beside `main.js`. Nest's `ConfigModule` loads it during bootstrap,
which is before `main.ts` reads `PORT` and before the SSR paths are checked, so
nothing needs exporting from pm2 as well. `apps/fitoverforty/backend/env.example`
documents every variable; four of them decide whether the site works at all.

|                      |                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WEB_ALLOWED_HOSTS`  | Must list the public hostname. It defaults to `localhost,127.0.0.1`, and left alone **every request under the real domain answers 400** — the whole site, not an edge case. |
| `SITE_URL`           | The public origin. No default; the backend refuses to start without it. It is Better Auth's only trusted origin.                                                            |
| `BETTER_AUTH_SECRET` | No default either. `openssl rand -base64 32`.                                                                                                                               |
| `API_ORIGIN`         | Optional, and only needed if the API is a different process. Leave it unset here: the renderer talks to itself on loopback.                                                 |

`WEB_SERVER_ENTRY` and `WEB_BROWSER_ASSETS_DIR` may be relative
(`../frontend/server/server.mjs`, `../frontend/browser`) because pm2 pins the
working directory — see the `cwd` comment in `pm2/ecosystem.config.cjs`.
`MAILER_TEMPLATE_DIR` is `./assets/email-templates` inside the artefact.

**Set `MEDIA_ROOT` to a path outside the deployment directory.** It defaults to
`.data/media`, which resolves against the working directory — that is, inside
the artefact the deploy replaces, so every uploaded image would disappear on the
next deploy. Something like `/var/lib/fitoverforty-test/media`. The deploy
excludes `.data/` from its `rsync --delete` as a second line of defence, but the
variable is the actual fix.

## Migrate

The artefact ships `migrate.js` beside `main.js` for exactly this, because a
deployed backend has no other way to reach its migrations: the classes are
bundled — `data-source.ts` imports them statically — but nothing in `main.js`
runs them, and the TypeORM CLI needs the workspace, the source data source and
the root `tsconfig.json`, none of which are on the server.

```bash
cd /var/www/fitoverforty-test/backend
node migrate.js
```

It reads the `.env` beside it, prints what it applied, says `No pending
migrations.` when there is nothing to do, and exits non-zero on failure.

Run it **before** starting or reloading the process, not after. New code against
an old schema boots perfectly happily and then fails on its first query, which is
a far worse failure than a deploy that stops here.

This is deliberately not `migrationsRun: true` on the data source: running
migrations at boot would tie them to every pm2 restart, bury the SQL among
application logs, and turn a migration failure into a crash loop whose cause a
health check can only infer.

`runMigrations()` wraps the whole set in one transaction, which is why a new
migration has to be tested against a _dropped_ schema rather than against a
working database — see the note in `CLAUDE.md`.

## Run

`pm2/ecosystem.config.cjs` defines one app per environment and carries no
secrets — process identity, paths, restart policy and logs only. Each deployed
backend owns the `.env` beside its own `main.js`, and pm2's `cwd` is what makes
the right one load, so staging and production stay isolated while sharing this
file. Start one environment at a time:

```bash
pm2 start ecosystem.config.cjs --only fitoverforty-backend-test
pm2 save
pm2 startup            # once, so it survives a reboot
```

Use `--only`, not a bare `pm2 start`, or you will also start the other
environment's process on the same machine.

## Staging deploys itself

`.github/workflows/deploy-staging.yml` does all of the above against
`test.fitoverforty.blog` from a single manual run: build, verify the artefact,
rsync both halves, install runtime dependencies, migrate, reload pm2, and smoke
check a server-rendered page.

It needs four repository secrets — `STAGING_SSH_HOST`, `STAGING_SSH_USER`,
`STAGING_SSH_KEY` and `STAGING_SSH_KNOWN_HOSTS` — and nothing else. Deployment
transport only: no database, mail or auth configuration goes near GitHub, because
the server's `.env` owns all of it.

The rsync preserves `.env`, `node_modules/`, `.yarn/` and `.data/` while deleting
anything else the build no longer produces. The server needs `corepack`, `rsync`
and `pm2` on the deploy user's `PATH`.

## Nginx

`nginx/fitoverforty.conf` terminates TLS, redirects HTTP, and proxies
everything to the upstream. Two details are not decoration:

- **`Host` is passed through unchanged** and `X-Forwarded-Proto` is set from
  `$scheme`, never from the caller's header. The app trusts the latter, so a
  value that could originate outside would be an SSRF vector.
- **The `default_server` block returns 444.** The app trusts `Host` for its
  canonical URLs, so something has to guarantee the name is one of ours;
  `WEB_ALLOWED_HOSTS` is the second half of that and neither makes the other
  redundant.

Validated with `nginx -t`, and then by running it in front of the artefact:
the redirect, the 444 for an unclaimed name, `https://` canonical URLs, gzip,
and a 404 that stays a 404 all behave.

## What a first deploy still has to discover

- TLS issuance, DNS, and the host itself.
- Whether the artefact is built on the server or shipped to it. Either works;
  the choice belongs with #64.
- Real mail delivery. Everything above ran against a local SMTP sink, and the
  mailer fails _after_ persisting a submission, so a wrong `MAILER_*` is quiet
  until someone uses the contact form.
- The MailerLite webhook, which needs a publicly reachable URL and so cannot be
  configured until one exists.
