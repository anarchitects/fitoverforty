import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Links a `blog.authors` row to the `auth.users` account that writes as it.
 *
 * The column is nullable and `ON DELETE SET NULL` on purpose. An author is the
 * byline on published work; a user is somebody who can still sign in. Removing
 * an account must not remove the attribution on posts that account wrote, and
 * seeded authors have no account at all — so the two are associated rather
 * than identified with each other.
 *
 * Unique because one account writes as one author. Two bylines for one person
 * is a feature nobody has asked for, and allowing it silently would make
 * "which author is this?" ambiguous at the moment a post is created.
 */
export class LinkAuthorsToUsers1787840262133 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blog"."authors"
        ADD COLUMN "user_id" uuid NULL
          REFERENCES "auth"."users" ("id") ON DELETE SET NULL
    `);

    // Partial: NULLs are distinct in a plain unique index anyway, but saying so
    // keeps the intent readable and the index off every account-less author.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_authors_user_id"
        ON "blog"."authors" ("user_id")
        WHERE "user_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "blog"."uq_authors_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog"."authors" DROP COLUMN IF EXISTS "user_id"`,
    );
  }
}
