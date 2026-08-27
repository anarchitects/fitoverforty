import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Better Auth persistence, in its own `auth` schema alongside forms, blog and
 * newsletter.
 *
 * The adapter package owns none of this on purpose — its README is explicit
 * that host repositories keep their own migrations — so the column set here
 * has to track Better Auth's expected fields rather than being generated.
 *
 * Those fields were read from `getAuthTables({})` in `@better-auth/core/db`
 * rather than from the adapter's README, which documents an older Better Auth
 * and omits `accounts.issuer`.
 *
 * Two deliberate departures from the rest of this repo's migrations:
 *
 *  - Column names are camelCase and therefore quoted. The adapter matches
 *    joined rows by property name, and a column renamed to snake_case is
 *    dropped from the joined projection — which breaks sign-in specifically,
 *    since it loads the user together with its accounts and then matches on
 *    `providerId`. Better Auth's own generated schema is camelCase too.
 *  - No row is seeded. Accounts are created by `tools/create-admin.ts`, which
 *    goes through Better Auth's own sign-up so the password hash matches what
 *    the running app will later verify against. A hash written by a migration
 *    would be a hash nobody can reproduce.
 */
export class CreateAuthSchema1787822337235 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "auth"`);

    await queryRunner.query(`
      CREATE TABLE "auth"."users" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email"         text        NOT NULL,
        "name"          text        NOT NULL,
        "emailVerified" boolean     NOT NULL DEFAULT false,
        "image"         text        NULL,
        "createdAt"     timestamptz NOT NULL DEFAULT now(),
        "updatedAt"     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "auth"."accounts" (
        "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "issuer"                  text        NOT NULL,
        "accountId"               text        NOT NULL,
        "providerId"              text        NOT NULL,
        "userId"                  uuid        NOT NULL,
        "accessToken"             text        NULL,
        "refreshToken"            text        NULL,
        "idToken"                 text        NULL,
        "accessTokenExpiresAt"    timestamptz NULL,
        "refreshTokenExpiresAt"   timestamptz NULL,
        "scope"                   text        NULL,
        "password"                text        NULL,
        "createdAt"               timestamptz NOT NULL DEFAULT now(),
        "updatedAt"               timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_accounts_user"
          FOREIGN KEY ("userId") REFERENCES "auth"."users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_accounts_user_id" ON "auth"."accounts" ("userId")`,
    );
    // Sign-in looks an account up by exactly this triple.
    await queryRunner.query(
      `CREATE INDEX "idx_accounts_identity" ON "auth"."accounts" ("providerId", "issuer", "accountId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "auth"."sessions" (
        "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"    uuid        NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "token"     text        NOT NULL,
        "ipAddress" text        NULL,
        "userAgent" text        NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_sessions_token" UNIQUE ("token"),
        CONSTRAINT "fk_sessions_user"
          FOREIGN KEY ("userId") REFERENCES "auth"."users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_sessions_user_id" ON "auth"."sessions" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "auth"."verifications" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "identifier" text        NOT NULL,
        "value"      text        NOT NULL,
        "expiresAt"  timestamptz NOT NULL,
        "createdAt"  timestamptz NOT NULL DEFAULT now(),
        "updatedAt"  timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_verifications_identifier" ON "auth"."verifications" ("identifier")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "auth"."verifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth"."sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth"."accounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth"."users"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "auth"`);
  }
}
