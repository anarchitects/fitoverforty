import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { register } from 'tsconfig-paths';

const WORKSPACE_ROOT = resolve(__dirname, '../../../../..');

/**
 * Makes workspace path aliases resolvable inside globalSetup.
 *
 * Jest runs globalSetup outside its own module registry, so the
 * `moduleNameMapper` in jest.config does not apply here. The data source
 * reaches the blog content code, which imports `@fitoverforty/content-model`
 * as a value, and without this that import fails with "Cannot find module".
 */
function registerWorkspacePaths(): void {
  const raw = readFileSync(
    resolve(WORKSPACE_ROOT, 'tsconfig.base.json'),
    'utf8',
  );
  // tsconfig files permit comments; JSON.parse does not.
  const withoutComments = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const paths = JSON.parse(withoutComments).compilerOptions?.paths ?? {};
  register({ baseUrl: WORKSPACE_ROOT, paths });
}

/**
 * Applies database migrations once, before any test worker starts.
 *
 * This cannot live in the suites themselves: Jest runs suites in parallel
 * workers, so on a fresh database concurrent `runMigrations()` calls race to
 * create the migrations table and one fails with a `pg_class` unique violation.
 */
export default async function globalSetup(): Promise<void> {
  registerWorkspacePaths();

  // eslint-disable-next-line @nx/enforce-module-boundaries
  const { makeRuntimeDataSource } = await import(
    '../../../backend/src/data-source'
  );

  const dataSource = makeRuntimeDataSource();
  await dataSource.initialize();

  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
