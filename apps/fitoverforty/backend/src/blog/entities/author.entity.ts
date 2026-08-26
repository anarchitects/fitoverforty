import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MediaEntity } from './media.entity';

/**
 * Authors are their own identity rather than a foreign key into an auth users
 * table, because Phase A has no authentication. Phase B adds a nullable
 * user_id linking a Better Auth account to an author, which keeps published
 * content independent of who can still log in.
 */
@Entity({ schema: 'blog', name: 'authors' })
export class AuthorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;

  @ManyToOne(() => MediaEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'avatar_media_id' })
  avatar!: MediaEntity | null;
}
