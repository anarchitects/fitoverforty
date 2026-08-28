import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Turns `newsletter.consents` into a consent *event log*.
 *
 * Until now the table only recorded that someone asked to be emailed. It never
 * learned that they later asked us to stop, because unsubscribing happens
 * inside MailerLite. A table that can only say "yes" makes a withdrawn consent
 * look current — which is exactly the failure mode when the table is the thing
 * handed to an auditor (spec §12).
 *
 * A withdrawal is a **new row**, never an update. The history is the evidence,
 * and overwriting it destroys the thing the table exists for.
 */
export class RecordConsentWithdrawal1787871010736 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * `consented_at` is renamed because it is now wrong half the time: on a
     * withdrawal row it would name the opposite of what the row records. In a
     * table whose entire purpose is evidencing consent, a column that lies
     * about what it timestamps is worse than the churn of renaming it.
     */
    await queryRunner.query(
      `ALTER TABLE "newsletter"."consents" RENAME COLUMN "consented_at" TO "recorded_at"`,
    );
    await queryRunner.query(
      `ALTER INDEX "newsletter"."idx_consents_consented_at" RENAME TO "idx_consents_recorded_at"`,
    );

    await queryRunner.query(`
      ALTER TABLE "newsletter"."consents"
        ADD COLUMN "kind" text NOT NULL DEFAULT 'granted'
    `);
    await queryRunner.query(`
      ALTER TABLE "newsletter"."consents"
        ADD CONSTRAINT "ck_consents_kind" CHECK ("kind" IN ('granted', 'withdrawn'))
    `);

    /**
     * What told us. For a withdrawal this is the provider event
     * (`mailerlite:subscriber.unsubscribed`); for a grant it stays null,
     * because the source of a grant is already the source_url the person
     * submitted from.
     */
    await queryRunner.query(
      `ALTER TABLE "newsletter"."consents" ADD COLUMN "event_source" text NULL`,
    );

    /**
     * Idempotency. Providers retry, and a retry must not look like a second
     * withdrawal.
     *
     * MailerLite's payload carries no event id, so the key is composed from
     * what does identify the event: the kind, the subscriber, and the instant
     * the provider says it changed. A genuine later unsubscribe — after a
     * re-subscribe — carries a different `updated_at` and so is a different
     * key, which is the property that matters. A UNIQUE index rather than a
     * read-then-write, because two retries can arrive concurrently.
     *
     * Null for rows written by the subscribe path, and NULLs are distinct in a
     * unique index, so those never collide.
     */
    await queryRunner.query(
      `ALTER TABLE "newsletter"."consents" ADD COLUMN "dedupe_key" text NULL`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_consents_dedupe_key"
        ON "newsletter"."consents" ("dedupe_key")
        WHERE "dedupe_key" IS NOT NULL
    `);

    /**
     * A withdrawal has no wording to evidence — nobody was shown a form — so
     * these stop being universally NOT NULL and become required only for the
     * rows that actually record an agreement.
     */
    await queryRunner.query(`
      ALTER TABLE "newsletter"."consents"
        ALTER COLUMN "consent_version" DROP NOT NULL,
        ALTER COLUMN "consent_text"    DROP NOT NULL
    `);
    // Replaced rather than kept: the old form required non-empty text on every
    // row, which a withdrawal cannot satisfy.
    await queryRunner.query(
      `ALTER TABLE "newsletter"."consents" DROP CONSTRAINT "ck_consents_text"`,
    );
    await queryRunner.query(`
      ALTER TABLE "newsletter"."consents"
        ADD CONSTRAINT "ck_consents_granted_has_wording" CHECK (
          "kind" <> 'granted' OR (
            "consent_version" IS NOT NULL
            AND "consent_text" IS NOT NULL
            AND char_length("consent_text") > 0
          )
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Withdrawal rows cannot satisfy the restored NOT NULL, and silently
    // deleting evidence to make a rollback tidy is not a trade worth making.
    // They are the only rows this can safely remove: it created them.
    await queryRunner.query(
      `DELETE FROM "newsletter"."consents" WHERE "kind" = 'withdrawn'`,
    );

    await queryRunner.query(
      `ALTER TABLE "newsletter"."consents" DROP CONSTRAINT "ck_consents_granted_has_wording"`,
    );
    await queryRunner.query(`
      ALTER TABLE "newsletter"."consents"
        ADD CONSTRAINT "ck_consents_text" CHECK (char_length("consent_text") > 0)
    `);
    await queryRunner.query(`
      ALTER TABLE "newsletter"."consents"
        ALTER COLUMN "consent_version" SET NOT NULL,
        ALTER COLUMN "consent_text"    SET NOT NULL
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "newsletter"."uq_consents_dedupe_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "newsletter"."consents" DROP COLUMN "dedupe_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "newsletter"."consents" DROP COLUMN "event_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "newsletter"."consents" DROP CONSTRAINT "ck_consents_kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE "newsletter"."consents" DROP COLUMN "kind"`,
    );
    await queryRunner.query(
      `ALTER INDEX "newsletter"."idx_consents_recorded_at" RENAME TO "idx_consents_consented_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "newsletter"."consents" RENAME COLUMN "recorded_at" TO "consented_at"`,
    );
  }
}
