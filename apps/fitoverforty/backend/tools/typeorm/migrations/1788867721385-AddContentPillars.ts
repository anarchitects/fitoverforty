import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the four content pillars decided on #78, and files every existing post
 * under one.
 *
 * A pillar is the *section* a post belongs to — exactly one — with tags left
 * as the open vocabulary underneath. That shape is why this is a foreign key
 * on posts rather than a second join table: "top-level" only means anything if
 * every post has one home.
 *
 * The slugs and names are written out as literals here rather than imported
 * from `PILLAR_SLUGS`. A migration has to mean the same thing for ever, and
 * that constant is free to move — the same trap that `SeedBlogContent` hit by
 * saving through an entity. Nothing in this file may import from the app.
 */
export class AddContentPillars1788867721385 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "blog"."pillars" (
        "id"       uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug"     text NOT NULL,
        "name"     text NOT NULL,
        "position" integer NOT NULL,
        CONSTRAINT "pk_pillars" PRIMARY KEY ("id"),
        CONSTRAINT "uq_pillars_slug" UNIQUE ("slug"),
        CONSTRAINT "uq_pillars_position" UNIQUE ("position"),
        CONSTRAINT "ck_pillars_slug_kebab" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
      )
    `);

    await queryRunner.query(`
      INSERT INTO "blog"."pillars" ("slug", "name", "position") VALUES
        ('physical-fitness',  'Physical Fitness',  1),
        ('mental-fitness',    'Mental Fitness',    2),
        ('emotional-fitness', 'Emotional Fitness', 3),
        ('financial-fitness', 'Financial Fitness', 4)
    `);

    await queryRunner.query(`
      ALTER TABLE "blog"."posts"
        ADD COLUMN "pillar_id" uuid NULL,
        ADD CONSTRAINT "fk_posts_pillar"
          FOREIGN KEY ("pillar_id") REFERENCES "blog"."pillars" ("id")
          ON DELETE RESTRICT
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_posts_pillar_id" ON "blog"."posts" ("pillar_id")`,
    );

    /**
     * Both seeded posts are training and nutrition, so both are Physical.
     * Written as a query over what is actually there rather than by id: the
     * ids are generated, and a migration that assumes particular rows exist
     * breaks against a database seeded differently.
     */
    await queryRunner.query(`
      UPDATE "blog"."posts"
         SET "pillar_id" = (
           SELECT "id" FROM "blog"."pillars" WHERE "slug" = 'physical-fitness'
         )
       WHERE "pillar_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "blog"."idx_posts_pillar_id"`);
    await queryRunner.query(
      `ALTER TABLE "blog"."posts" DROP CONSTRAINT "fk_posts_pillar"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog"."posts" DROP COLUMN "pillar_id"`,
    );
    await queryRunner.query(`DROP TABLE "blog"."pillars"`);
  }
}
