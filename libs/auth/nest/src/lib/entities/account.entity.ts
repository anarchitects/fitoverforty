import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Better Auth's `account` model — one row per credential or provider link.
 *
 * `password` holds the hash for email-and-password sign-in. It lives here
 * rather than on the user because Better Auth treats credentials as one
 * provider among several.
 */
@Entity({ schema: 'auth', name: 'accounts' })
@Index('idx_accounts_user_id', ['userId'])
export class AuthAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Which issuer the account identity belongs to. Null on Better Auth 1.6.
   *
   * The field arrived in 1.7, which scopes account identity by issuer so that
   * the same `accountId` from two different providers cannot collide. This app
   * is pinned to `~1.6.30` because the adapter was validated against < 1.7
   * (see anarchitecture-community#509), and on 1.6 the field does not exist:
   * `getAuthTables({})` from `better-auth/db` does not list it, so nothing
   * writes it.
   *
   * Kept and nullable rather than removed, because the pin is interim — when
   * the adapter supports 1.7 this becomes required again. If you are reading
   * this after that upgrade, `issuer` should go back to NOT NULL, and its
   * absence surfaces as "Could not resolve field \"issuer\" for Better Auth
   * model \"accounts\"" at the first sign-up.
   */
  @Column({ type: 'text', nullable: true })
  issuer!: string | null;

  @Column({ type: 'text' })
  accountId!: string;

  @Column({ type: 'text' })
  providerId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', nullable: true })
  accessToken!: string | null;

  @Column({ type: 'text', nullable: true })
  refreshToken!: string | null;

  @Column({ type: 'text', nullable: true })
  idToken!: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  accessTokenExpiresAt!: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  refreshTokenExpiresAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  scope!: string | null;

  @Column({ type: 'text', nullable: true })
  password!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
