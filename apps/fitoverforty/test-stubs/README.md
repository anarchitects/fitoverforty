# Jest stubs for ESM-only packages

`better-auth` and `@anarchitects/better-auth-typeorm-adapter` are ESM-only:
`"type": "module"`, shipping `.mjs`, with no CommonJS build.

The backend and backend-e2e suites run as CommonJS under ts-jest, and **there
is no configuration that makes Jest load those packages there**. This is not a
missing `transformIgnorePatterns` entry — `jest-resolve`'s `shouldLoadAsEsm`
returns `true` for a `.mjs` extension unconditionally, before any transform is
consulted, so the file is routed to the ESM loader and fails with "Cannot use
import statement outside a module" whatever the transform says. The same is
true of the adapter, whose `package.json` declares `"type": "module"`.

Node 24 itself is fine with them — `require(esm)` handles both, which is why
the production webpack bundle works and why the Playwright suite, which drives
a real built server, exercises the genuine sign-in path.

So the two packages are mapped to these stubs in the Jest suites only. The
stubs are deliberately loud: every function they expose throws if it is
actually called, so a test that reaches real auth behaviour fails with a clear
message instead of quietly passing against a no-op.

What this costs: the backend suites can assert how the app is _wired_ — that
`AuthModule` composes, that the guard rejects an unauthenticated request, that
the Fastify bridge converts requests and responses correctly — but not Better
Auth's own behaviour. Actual sign-in is covered by `fitoverforty-frontend-e2e`.

## Reaching guarded routes anyway

The stub means `AdminGuard` cannot succeed: `api.getSession` throws, and every
authenticated route answers 500. That would leave the entire authoring API
untestable in `backend-e2e`, which is where it most wants testing — it is the
part that writes to a real database.

So `createFastifyTestApp({ signedInAs })` overrides `AUTH_INSTANCE` with an
object whose `getSession` returns that user and whose every other method is
absent, so a route reaching for more of Better Auth still fails loudly. Calling
it without `signedInAs` leaves the stub in place, which is what an
"unauthenticated requests are rejected" test needs.

What this does **not** prove is that sign-in works — that is Playwright's job,
against a real built server. The seam is for testing what happens *given* a
session, not for manufacturing one.
