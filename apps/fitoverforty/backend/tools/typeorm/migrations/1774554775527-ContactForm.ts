import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the contact form configuration.
 *
 * **Raw SQL with an explicit column list, and no entity import.** A migration
 * has to mean the same thing forever; an entity means whatever HEAD says today.
 * `SeedBlogContent` was written the other way and adding a column in a *later*
 * migration retroactively broke it — the entity gained the column, the insert
 * started naming it, and it does not exist yet at that point in the sequence.
 * Because `runMigrations()` wraps the whole set in one transaction, the rollback
 * emptied the database and the visible failure pointed nowhere near the cause.
 *
 * The hazard is sharper here than it was there. `FormConfigEntity` belongs to
 * `@anarchitects/forms-nest`, so its column list moves on *that package's*
 * release schedule rather than on this repository's commits — a `yarn upgrade`
 * could break a migration nobody touched. The literal below is frozen at the
 * five columns that exist when this migration runs: `id`, `version`, `fields`,
 * `security` and `delivery`, created by `CreateFormsTables1720300000000`.
 * `validationRules` is left unset on purpose; it is nullable, and naming it
 * here would be guessing at a shape this form does not use.
 *
 * The `FormConfig` type is deliberately not imported either, for the same
 * reason: a type that moves can change whether this file still compiles.
 */
export class ContactForm1774554775527 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const fields = [
      {
        name: 'name',
        kind: 'string',
        required: true,
        ui: {
          label: 'Name',
          placeholder: 'Enter your name',
        },
      },
      {
        name: 'email',
        kind: 'email',
        required: true,
        ui: {
          label: 'Email',
          placeholder: 'Enter your email',
        },
      },
      {
        name: 'message',
        kind: 'textarea',
        required: true,
        ui: {
          label: 'Message',
          placeholder: 'Enter your message',
          rows: 5,
        },
      },
    ];

    const security = {
      honeypot: 'website',
      captcha: 'none',
    };

    const delivery = {
      adminEmail: 'info@fitoverforty.blog',
      subject: 'New Contact Form Submission',
      templateId: 'contact-form-notification',
      autoReply: {
        enabled: true,
        subject: 'Thank you for contacting us!',
        templateId: 'contact-form-autoreply',
      },
    };

    /**
     * `JSON.stringify` on every jsonb value rather than passing the object.
     * node-postgres serialises a plain object to JSON on its own, but converts
     * a JavaScript *array* to a Postgres array literal — so `fields` would
     * arrive malformed. Stringifying all three keeps them consistent and does
     * not depend on that distinction.
     */
    await queryRunner.query(
      `INSERT INTO "forms"."form_configs"
         ("id", "version", "fields", "security", "delivery")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'contact-form',
        1,
        JSON.stringify(fields),
        JSON.stringify(security),
        JSON.stringify(delivery),
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "forms"."form_configs" WHERE "id" = $1`,
      ['contact-form'],
    );
  }
}
