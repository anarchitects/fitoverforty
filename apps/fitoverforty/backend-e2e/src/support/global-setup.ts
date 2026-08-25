/**
 * Applies database migrations once, before any test worker starts.
 *
 * This cannot live in the suites themselves: Jest runs suites in parallel
 * workers, so on a fresh database concurrent `runMigrations()` calls race to
 * create the migrations table and one fails with a `pg_class` unique violation.
 */
export default async function globalSetup(): Promise<void> {
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
