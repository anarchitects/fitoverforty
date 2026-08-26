/**
 * Runtime seeding is not used for blog content.
 *
 * The `db:seed` executor loads this file with `import()`, which under Node 24
 * makes it an ES module. Extensionless relative imports do not resolve there,
 * so anything this file pulls in from `src/` would need `.ts` extensions all
 * the way down — including inside `src/` itself, where webpack and tsc expect
 * the opposite.
 *
 * Blog content is therefore seeded by a migration, the same way the contact
 * form config is. Migrations run through the TypeORM CLI, which uses the root
 * tsconfig and CommonJS, where those imports resolve normally.
 */
export default async function seed() {
  // Add runtime seed data here if a future need cannot be met by a migration.
}
