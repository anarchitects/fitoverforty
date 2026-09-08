import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { OutputData, PostStatus } from '@fitoverforty/blog-ts';
import { AuthorEntity } from './author.entity';
import { MediaEntity } from './media.entity';
import { PillarEntity } from './pillar.entity';
import { TagEntity } from './tag.entity';

/**
 * Re-exported rather than redeclared: the editor and the database have to mean
 * the same thing by "published", and two literal unions drift.
 */
export type { PostStatus };

/** Bumped when the stored block shape changes in a way that needs migrating. */
export const CURRENT_BODY_SCHEMA_VERSION = 1;

@Entity({ schema: 'blog', name: 'posts' })
@Index('idx_posts_status_published_at', ['status', 'publishedAt'])
export class PostEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  /** Editor.js OutputData, sanitised on write. Never trusted on read. */
  @Column({ type: 'jsonb' })
  body!: OutputData;

  @Column({
    type: 'int',
    name: 'body_schema_version',
    default: CURRENT_BODY_SCHEMA_VERSION,
  })
  bodySchemaVersion!: number;

  @Column({ type: 'text' })
  status!: PostStatus;

  /**
   * Null while drafting. A future value on a published post is a scheduled
   * post: read queries filter on published_at <= now().
   */
  @Column({ type: 'timestamptz', name: 'published_at', nullable: true })
  publishedAt!: Date | null;

  /** Computed on write so listing pages never parse block JSON. */
  @Column({ type: 'int', name: 'reading_time_minutes' })
  readingTimeMinutes!: number;

  @ManyToOne(() => MediaEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hero_media_id' })
  hero!: MediaEntity | null;

  /**
   * The section this post belongs to. Exactly one, or none while drafting.
   *
   * Nullable for the same reason `blog.media.alt` may be empty at upload:
   * `PostAdminService.publish` is what refuses, so an unfinished post can be
   * parked without having decided where it lives. RESTRICT rather than SET
   * NULL because a pillar is never deleted in normal operation, and silently
   * unfiling every post in one would be a poor way to find out.
   */
  @ManyToOne(() => PillarEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pillar_id' })
  pillar!: PillarEntity | null;

  @ManyToMany(() => TagEntity)
  @JoinTable({
    name: 'post_tags',
    schema: 'blog',
    joinColumn: { name: 'post_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags!: TagEntity[];

  @ManyToMany(() => AuthorEntity)
  @JoinTable({
    name: 'post_authors',
    schema: 'blog',
    joinColumn: { name: 'post_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'author_id', referencedColumnName: 'id' },
  })
  authors!: AuthorEntity[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
