import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes `auth.accounts.issuer` nullable, because the app has moved back to
 * Better Auth 1.6.
 *
 * `issuer` arrived in Better Auth 1.7, which scopes account identity by it.
 * `@anarchitects/better-auth-typeorm-adapter@0.1.1` was built and validated
 * against < 1.7, so the app is pinned to `~1.6.30` until an adapter supporting
 * 1.7 is released — see anarchitects/anarchitecture-community#509.
 *
 * On 1.6 the field does not exist at all. `getAuthTables({})` from
 * `better-auth/db` reports `account` as accountId, providerId, userId, the
 * token fields, scope, password, createdAt, updatedAt — and no issuer. So
 * nothing ever writes the column, and leaving it NOT NULL would reject every
 * account insert: sign-up and sign-in both break.
 *
 * The column is kept rather than dropped, deliberately. This is an interim
 * state with a known end: when the adapter supports 1.7 the column is needed
 * again, and re-adding it would mean re-deriving what it holds. Nullable costs
 * nothing meanwhile, and an unused column is cheaper than a lost one.
 *
 * `idx_accounts_identity` on ("providerId", "issuer", "accountId") is kept for
 * the same reason. With every issuer null it does less work than it will, but
 * it stays correct.
 */
export class RelaxAccountIssuer1787926754714 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth"."accounts" ALTER COLUMN "issuer" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /**
     * Rows written under 1.6 have no issuer, so restoring NOT NULL would fail
     * on them. They are backfilled from `providerId`, which is what 1.7 would
     * have recorded for a credential account: the issuer of an account created
     * by this app is this app.
     */
    await queryRunner.query(
      `UPDATE "auth"."accounts" SET "issuer" = "providerId" WHERE "issuer" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth"."accounts" ALTER COLUMN "issuer" SET NOT NULL`,
    );
  }
}
