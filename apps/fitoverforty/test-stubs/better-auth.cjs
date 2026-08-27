/**
 * CommonJS stand-in for the ESM-only `better-auth`. See README.md here.
 *
 * `betterAuth()` returns a shaped object so module construction succeeds, but
 * every entry point throws, so no test can accidentally assert against fake
 * auth behaviour and believe it.
 */
function unavailable(what) {
  return () => {
    throw new Error(
      `better-auth is stubbed in Jest (${what}). It is ESM-only and cannot ` +
        'load in these CommonJS suites; cover this in fitoverforty-frontend-e2e.',
    );
  };
}

function betterAuth(options) {
  return {
    options,
    handler: unavailable('handler'),
    api: {
      getSession: unavailable('api.getSession'),
      signInEmail: unavailable('api.signInEmail'),
      signUpEmail: unavailable('api.signUpEmail'),
      signOut: unavailable('api.signOut'),
    },
  };
}

module.exports = { betterAuth };
