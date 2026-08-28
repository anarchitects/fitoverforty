import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Better Auth's `user` model.
 *
 * The adapter is model-map driven: it resolves Better Auth's field names
 * through TypeORM entity metadata, so the property names here have to match
 * Better Auth's fields exactly. The `name` mappings below are free to be
 * snake_case because only the column name differs, not the property.
 *
 * These four entities are deliberately Better Auth-shaped rather than reusing
 * `blog.authors`. The adapter README is explicit that it will not map itself
 * onto arbitrary application entities, and an authentication record and an
 * authorship record have different lifetimes anyway — revoking a login should
 * not orphan a byline.
 */
/**
 * Column names are camelCase, matching the property names exactly.
 *
 * This breaks the snake_case convention every other table in this repo
 * follows, and it is not a style choice. The adapter resolves joined rows by
 * property name only: when a column is renamed with `name:`, the joined
 * projection silently drops it. Sign-in fetches the user *with* its accounts
 * and then matches on `providerId`, so `provider_id` made every sign-in fail
 * as "User not found" while the row sat correctly in the table.
 *
 * Better Auth's own generated schema uses camelCase columns too, so this is
 * its table shape rather than ours.
 */
@Entity({ schema: 'auth', name: 'users' })
export class AuthUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ type: 'text', nullable: true })
  image!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
