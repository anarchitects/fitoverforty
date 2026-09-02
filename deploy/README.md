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
/srv/fitoverforty/current/
  server/            # dist/apps/fitoverforty/backend  — main.js, package.json,
                     #   yarn.lock, .yarnrc.yml, assets/, plus .env and
                     #   node_modules created on the server
  web/
    browser/         # dist/apps/fitoverforty/frontend/browser
    server/          # dist/apps/fitoverforty/frontend/server
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

`WEB_SERVER_ENTRY` and `WEB_BROWSER_ASSETS_DIR` may be relative (`../web/server/server.mjs`,
`../web/browser`) because pm2 pins the working directory — see the `cwd` comment
in `pm2/ecosystem.config.cjs`. `MAILER_TEMPLATE_DIR` is `./assets/email-templates`
inside the artefact.

## Migrate

Migrations run from the workspace, not the artefact — the TypeORM CLI needs the
source data source and the root `tsconfig.json`.

```bash
corepack yarn nx run fitoverforty-backend:db:migrate:run
```

Point `TYPEORM_*` at the deployed database when running it. Verified against a
freshly created, empty database: the full set applies in one transaction with no
errors, which is the standing rule that a migration must work against a dropped
schema, checked rather than assumed.

## Run

```bash
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
pm2 startup            # once, so it survives a reboot
```

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
