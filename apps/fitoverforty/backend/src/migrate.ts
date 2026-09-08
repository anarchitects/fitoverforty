// `data-source.ts` loads `.env` itself, before it reads anything from the
// environment — see the note at the top of that file. This entry point needs no
// dotenv of its own, and adding one would imply the data source could be used
// safely without it.
import { AppDataSource } from './data-source';

/**
 * Applies pending migrations, as a deployment step.
 *
 * This exists because a deploy has no other way to reach them. The migration
 * classes are statically imported by `data-source.ts` and so are bundled into
 * the artefact, but nothing in `main.js` runs them and the TypeORM CLI is not
 * part of a deployed backend — it needs the workspace, the source data source
 * and the root tsconfig, none of which are on the server.
 *
 * It is deliberately a separate entry point rather than `migrationsRun: true`
 * on the data source. Running migrations at boot would tie them to every pm2
 * restart, hide the SQL among application logs, and turn a migration failure
 * into a crash loop that a health check has to infer the cause of. As its own
 * step it either succeeds or fails the deploy, before the new code is started.
 *
 * `runMigrations()` wraps the whole set in one transaction, so a failure part
 * way through leaves the schema as it was — see the note in CLAUDE.md about
 * testing a new migration against a dropped schema, which is what that
 * all-or-nothing behaviour makes necessary.
 */
async function main(): Promise<void> {
  const dataSource = await AppDataSource.initialize();

  try {
    const applied = await dataSource.runMigrations();

    if (applied.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    console.log(`Applied ${applied.length} migration(s):`);
    for (const migration of applied) {
      console.log(`  ${migration.name}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
