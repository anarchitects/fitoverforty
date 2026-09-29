import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives an author something to say on their own page.
 *
 * Nullable, because a byline is not a biography: an author row exists the
 * moment somebody is credited on a post, and requiring prose before that can
 * happen would make attribution the harder path. An author page renders the
 * name and the posts whether or not a bio has been written.
 *
 * Plain text rather than blocks. The block contract in
 * `@fitoverforty/blog-ts` exists so post bodies can be validated, rendered and
 * edited consistently; a two-sentence bio needs none of that, and reaching for
 * it here would mean the editor, the validator and the renderer all had to
 * learn about authors to display one paragraph.
 *
 * No seed data. The two seeded authors are real people, and this migration is
 * not the place to invent words for them — `SeedBlogContent` deliberately
 * created them without bios and they stay that way until somebody writes one.
 */
export class AddAuthorBios1788960000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blog"."authors"
        ADD COLUMN "bio" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blog"."authors" DROP COLUMN IF EXISTS "bio"
    `);
  }
}
