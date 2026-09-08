import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A content pillar: the section a post belongs to.
 *
 * A table rather than an enum column, so the name and ordering can change
 * without a migration and so `postsByPillar` can join rather than filter on a
 * string. The *set* is still fixed — see `PILLAR_SLUGS` in
 * `@fitoverforty/blog-ts` — and nothing in the app creates rows here; the
 * four arrive in a migration.
 */
@Entity({ schema: 'blog', name: 'pillars' })
export class PillarEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** kebab-case, enforced by a check constraint. One of PILLAR_SLUGS. */
  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;

  /**
   * Display order, so the four always read Physical → Mental → Emotional →
   * Financial. Alphabetical would put Emotional first and Physical third,
   * which is neither the order they were designed in nor a useful one.
   */
  @Column({ type: 'int' })
  position!: number;
}
