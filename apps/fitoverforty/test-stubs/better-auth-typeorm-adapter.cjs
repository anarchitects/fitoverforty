/**
 * CommonJS stand-in for the ESM-only
 * `@anarchitects/better-auth-typeorm-adapter`. See README.md here.
 */
function createBetterAuthTypeormAdapter(options) {
  return () => {
    throw new Error(
      '@anarchitects/better-auth-typeorm-adapter is stubbed in Jest. It is ' +
        'ESM-only and cannot load in these CommonJS suites. Options were: ' +
        `${Object.keys(options ?? {}).join(', ')}`,
    );
  };
}

module.exports = { createBetterAuthTypeormAdapter };
