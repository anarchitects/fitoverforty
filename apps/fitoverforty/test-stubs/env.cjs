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

/**
 * `createAuth` also refuses to build without `SITE_URL`, because that value is
 * the sole trusted origin for the auth endpoints and the base for session
 * cookies — a development default in the production code would put localhost
 * on a deployed instance's trusted list for ever.
 *
 * Supplied here for the same reason as the secret. `setupFiles` runs once per
 * test file, so a suite that deletes this to exercise the refusal does not
 * leave the next one unable to boot.
 */
process.env.SITE_URL ??= 'http://localhost:4200';
