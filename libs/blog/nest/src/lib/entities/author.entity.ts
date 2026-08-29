import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MediaEntity } from './media.entity';

/**
 * Authors are their own identity rather than a foreign key into an auth users
 * table. `userId` associates an account with a byline without identifying the
 * two: seeded authors have no account, and deleting an account must not erase
 * the attribution on what it published.
 */
@Entity({ schema: 'blog', name: 'authors' })
export class AuthorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;

  /**
   * The Better Auth account that writes as this author, if any.
   *
   * A plain column rather than a relation: the auth entities live in another
   * schema and another module, and the blog has no business loading a user.
   */
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  @ManyToOne(() => MediaEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'avatar_media_id' })
  avatar!: MediaEntity | null;
}
