import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Paul's author bio, in his own words.
 *
 * `AddAuthorBios` added the column and deliberately seeded nothing, on the
 * grounds that inventing words for a real person is not a migration's job.
 * These are not invented — Paul wrote them — so the objection does not apply.
 *
 * A migration rather than a row edit because nothing writes `authors.bio`:
 * there is no admin screen and no API for it, so a direct UPDATE against
 * staging would be lost the next time the database is rebuilt and would never
 * reach production. The contact form is configured the same way, for the same
 * reason. If an author editor is ever built, this stays as history and the
 * editor takes over from here.
 *
 * Raw SQL, not `AuthorEntity`. A migration has to mean the same thing for
 * ever, and an entity means whatever HEAD says today — which is exactly how
 * `SeedBlogContent` broke when `authors.user_id` arrived after it.
 *
 * Keyed on the slug and written as an UPDATE, so a database seeded without
 * that author is a no-op rather than a failure. Nothing here assumes a
 * particular row exists.
 */
export class SetPaulAuthorBio1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "blog"."authors" SET "bio" = $1 WHERE "slug" = $2`,
      [
        'I am not fit. Not by any of the four measures this site uses, ' +
          'which is the point of writing it down. Late forties, a job that ' +
          'mostly involves sitting on my ass in front of a laptop, and a ' +
          'long history of training inconsistently: lifting, running, ' +
          'cycling, walking, and whatever the property needed doing. ' +
          'Consistency is what I am actually chasing.',
        'paul',
      ],
    );
  }

  /**
   * Back to NULL rather than to some previous text: there was none. The
   * author page renders the name and the posts without a bio, which is the
   * state this reverses to.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "blog"."authors" SET "bio" = NULL WHERE "slug" = $1`,
      ['paul'],
    );
  }
}
