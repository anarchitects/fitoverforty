import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'blog', name: 'media' })
export class MediaEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Opaque key in whatever store backs MediaStoragePort. */
  @Column({ type: 'text', name: 'storage_key', unique: true })
  storageKey!: string;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'text' })
  mime!: string;

  @Column({ type: 'bigint' })
  bytes!: string;

  @Column({ type: 'int' })
  width!: number;

  @Column({ type: 'int' })
  height!: number;

  /** Never nullable: an image without alt text should not reach the database. */
  @Column({ type: 'text' })
  alt!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
