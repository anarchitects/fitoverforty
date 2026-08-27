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
   * Which issuer the account identity belongs to.
   *
   * Required since Better Auth 1.7, which scopes account identity by issuer so
   * that the same `accountId` from two different providers cannot collide. The
   * adapter package's README predates that change and does not list this
   * field — its absence surfaces only at the first sign-up, as "Could not
   * resolve field \"issuer\" for Better Auth model \"accounts\"".
   */
  @Column({ type: 'text' })
  issuer!: string;

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
