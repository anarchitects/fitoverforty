/**
 * Test-only environment defaults.
 *
 * `createAuth` refuses to build without `BETTER_AUTH_SECRET`, deliberately —
 * a placeholder signing secret would make admin session cookies forgeable by
 * anyone who can read the repository. That refusal is the behaviour under
 * test, so the suites supply an obviously-fake value here rather than the
 * production code growing a development default.
 */
process.env.BETTER_AUTH_SECRET ??=
  'test-only-secret-not-used-outside-jest-0123456789';
