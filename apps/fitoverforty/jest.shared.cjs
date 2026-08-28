/**
 * Jest settings shared by the backend, backend-e2e and the Nest libraries.
 *
 * They all reach the same code through AppModule, so they all need the same
 * workarounds. They live here rather than in each config because they have
 * already drifted apart once.
 *
 * **Paths are absolute, resolved from this file.** They used to be
 * `<rootDir>`-relative, which silently means something different depending on
 * how deep the consuming project sits — fine while only the two backend
 * projects used it, wrong the moment a `libs/<domain>/nest` project did.
 */
const { resolve } = require('node:path');
const here = (...parts) => resolve(__dirname, ...parts);

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
 * Workspace path aliases, read from `tsconfig.base.json`.
 *
 * Jest does not read tsconfig `paths`, so they have to be restated — but
 * restating them by hand means every library that moves breaks these suites
 * with a `Cannot find module` that points at `data-source.ts` rather than at
 * the mapping. Deriving them keeps the two in step by construction.
 *
 * Note this does NOT cover backend-e2e's globalSetup: Jest runs that outside
 * its own module registry, so it registers tsconfig-paths itself.
 */
function aliasesFromTsconfig() {
  const root = here('../..');
  const { compilerOptions } = require(resolve(root, 'tsconfig.base.json'));
  const mapped = {};
  for (const [alias, [target]] of Object.entries(compilerOptions.paths ?? {})) {
    if (alias.endsWith('/*')) {
      // e.g. '@fitoverforty/blog-angular-feature/*' -> capture the subpath.
      mapped[`^${alias.slice(0, -2)}/(.*)$`] = resolve(
        root,
        target.replace(/\*$/, ''),
      ) + '$1';
    } else {
      mapped[`^${alias}$`] = resolve(root, target);
    }
  }
  return mapped;
}

const moduleNameMapper = {
  ...aliasesFromTsconfig(),

  /**
   * better-auth and its TypeORM adapter are ESM-only and CANNOT be loaded in
   * these CommonJS suites — `jest-resolve` treats a `.mjs` extension, and a
   * `"type": "module"` package, as ESM before any transform is consulted, so
   * no `transformIgnorePatterns` entry helps. See `../test-stubs/README.md`.
   */
  '^better-auth$': here('test-stubs/better-auth.cjs'),
  '^@anarchitects/better-auth-typeorm-adapter$': here(
    'test-stubs/better-auth-typeorm-adapter.cjs',
  ),
};

/** Environment the suites need before any module is constructed. */
const setupFiles = [here('test-stubs/env.cjs')];

module.exports = { transformIgnorePatterns, moduleNameMapper, setupFiles };
