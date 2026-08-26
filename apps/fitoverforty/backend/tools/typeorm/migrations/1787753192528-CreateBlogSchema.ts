import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the blog schema: posts, tags, authors, media and their join tables.
 *
 * Lives in its own schema for the same reason the forms tables do — a query
 * scoped to public will not see it, which is worth knowing before concluding
 * the database is empty.
 */
export class CreateBlogSchema1787753192528 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "blog"`);

    await queryRunner.query(`
      CREATE TABLE "blog"."media" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "storage_key" text        NOT NULL,
        "url"         text        NOT NULL,
        "mime"        text        NOT NULL,
        "bytes"       bigint      NOT NULL,
        "width"       integer     NOT NULL,
        "height"      integer     NOT NULL,
        "alt"         text        NOT NULL,
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_media_storage_key" UNIQUE ("storage_key"),
        CONSTRAINT "ck_media_dimensions"  CHECK ("width" > 0 AND "height" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "blog"."authors" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug"            text NOT NULL,
        "name"            text NOT NULL,
        "avatar_media_id" uuid NULL REFERENCES "blog"."media" ("id") ON DELETE SET NULL,
        CONSTRAINT "uq_authors_slug" UNIQUE ("slug"),
        CONSTRAINT "ck_authors_slug_kebab" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "blog"."tags" (
        "id"   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" text NOT NULL,
        "name" text NOT NULL,
        CONSTRAINT "uq_tags_slug" UNIQUE ("slug"),
        CONSTRAINT "ck_tags_slug_kebab" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "blog"."posts" (
        "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug"                 text        NOT NULL,
        "title"                text        NOT NULL,
        "description"          text        NOT NULL,
        "body"                 jsonb       NOT NULL,
        "body_schema_version"  integer     NOT NULL DEFAULT 1,
        "status"               text        NOT NULL DEFAULT 'draft',
        "published_at"         timestamptz NULL,
        "reading_time_minutes" integer     NOT NULL,
        "hero_media_id"        uuid        NULL REFERENCES "blog"."media" ("id") ON DELETE SET NULL,
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "updated_at"           timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_posts_slug" UNIQUE ("slug"),
        CONSTRAINT "ck_posts_slug_kebab"   CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        CONSTRAINT "ck_posts_status"       CHECK ("status" IN ('draft', 'published')),
        CONSTRAINT "ck_posts_description"  CHECK (char_length("description") BETWEEN 1 AND 160),
        CONSTRAINT "ck_posts_reading_time" CHECK ("reading_time_minutes" >= 1),
        CONSTRAINT "ck_posts_published_at" CHECK ("status" = 'draft' OR "published_at" IS NOT NULL)
      )
    `);

    // The archive query: published posts, newest first, honouring scheduling.
    await queryRunner.query(`
      CREATE INDEX "idx_posts_status_published_at"
        ON "blog"."posts" ("status", "published_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "blog"."post_tags" (
        "post_id" uuid NOT NULL REFERENCES "blog"."posts" ("id") ON DELETE CASCADE,
        "tag_id"  uuid NOT NULL REFERENCES "blog"."tags"  ("id") ON DELETE CASCADE,
        CONSTRAINT "pk_post_tags" PRIMARY KEY ("post_id", "tag_id")
      )
    `);
    // Reverse lookup for /blog/tag/:slug; the PK only serves post -> tags.
    await queryRunner.query(
      `CREATE INDEX "idx_post_tags_tag_id" ON "blog"."post_tags" ("tag_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "blog"."post_authors" (
        "post_id"   uuid NOT NULL REFERENCES "blog"."posts"   ("id") ON DELETE CASCADE,
        "author_id" uuid NOT NULL REFERENCES "blog"."authors" ("id") ON DELETE CASCADE,
        CONSTRAINT "pk_post_authors" PRIMARY KEY ("post_id", "author_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "blog"."post_authors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog"."post_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog"."posts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog"."tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog"."authors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog"."media"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "blog"`);
  }
}
