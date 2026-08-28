/**
 * Jest settings shared by the backend and backend-e2e projects.
 *
 * Both reach the same code through AppModule, so both need the same two
 * workarounds. They live here rather than in each config because they have
 * already drifted apart once.
 */

/**
 * sanitize-html is CommonJS, but its htmlparser2 chain is ESM-only. Node 24
 * copes via require(esm); Jest does not, so that chain has to be transformed
 * rather than skipped the way node_modules normally is.
 *
 * Matching on package names rather than paths keeps this working whether Yarn
 * hoists them to the top level or nests them under sanitize-html.
 */
const transformIgnorePatterns = [
  'node_modules/(?!.*(?:sanitize-html|htmlparser2|domhandler|domelementtype|domutils|dom-serializer|entities))',
];

/**
 * Workspace path aliases. Jest does not read tsconfig `paths`.
 *
 * Note this does NOT cover backend-e2e's globalSetup: Jest runs that outside
 * its own module registry, so it registers tsconfig-paths itself.
 */
const moduleNameMapper = {
  '^@fitoverforty/blog-ts$':
    '<rootDir>/../../../libs/blog/ts/src/index.ts',

  /**
   * better-auth and its TypeORM adapter are ESM-only and CANNOT be loaded in
   * these CommonJS suites — `jest-resolve` treats a `.mjs` extension, and a
   * `"type": "module"` package, as ESM before any transform is consulted, so
   * no `transformIgnorePatterns` entry helps. See `../test-stubs/README.md`.
   */
  '^better-auth$': '<rootDir>/../test-stubs/better-auth.cjs',
  '^@anarchitects/better-auth-typeorm-adapter$':
    '<rootDir>/../test-stubs/better-auth-typeorm-adapter.cjs',
};

/** Environment the suites need before any module is constructed. */
const setupFiles = ['<rootDir>/../test-stubs/env.cjs'];

module.exports = { transformIgnorePatterns, moduleNameMapper, setupFiles };
