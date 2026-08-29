import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'blog', name: 'tags' })
export class TagEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** kebab-case, enforced by a check constraint. */
  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;
}
