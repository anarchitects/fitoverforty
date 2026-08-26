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
  '^@fitoverforty/content-model$':
    '<rootDir>/../../../libs/shared/content-model/src/index.ts',
};

module.exports = { transformIgnorePatterns, moduleNameMapper };
