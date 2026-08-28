import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Better Auth's `session` model. The token is what the cookie carries. */
@Entity({ schema: 'auth', name: 'sessions' })
@Index('idx_sessions_user_id', ['userId'])
export class AuthSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'text', unique: true })
  token!: string;

  @Column({ type: 'text', nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
