import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records of consent to receive the newsletter.
 *
 * Its own schema, like forms and blog. Under UK GDPR the controller has to be
 * able to evidence consent, so the wording shown is stored alongside the
 * address rather than being reconstructed from git history later.
 */
export class CreateNewsletterSchema1787784560093 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "newsletter"`);

    await queryRunner.query(`
      CREATE TABLE "newsletter"."consents" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email"           text        NOT NULL,
        "consent_version" text        NOT NULL,
        "consent_text"    text        NOT NULL,
        "source_url"      text        NULL,
        "ip_address"      inet        NULL,
        "consented_at"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_consents_email" CHECK (char_length("email") BETWEEN 3 AND 254),
        CONSTRAINT "ck_consents_text"  CHECK (char_length("consent_text") > 0)
      )
    `);

    // Rows are kept, not replaced: re-subscribing is a new act of consent, and
    // the history is the evidence. Lookups are therefore by email, not unique.
    await queryRunner.query(
      `CREATE INDEX "idx_consents_email" ON "newsletter"."consents" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_consents_consented_at" ON "newsletter"."consents" ("consented_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "newsletter"."consents"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "newsletter"`);
  }
}
