import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Better Auth's `verification` model — short-lived tokens for flows such as
 * password reset. Nothing in v1 issues these yet, but the adapter expects the
 * model to exist, and a missing table only fails at the moment someone needs
 * it most.
 */
@Entity({ schema: 'auth', name: 'verifications' })
@Index('idx_verifications_identifier', ['identifier'])
export class AuthVerificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  identifier!: string;

  @Column({ type: 'text' })
  value!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
