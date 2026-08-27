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
