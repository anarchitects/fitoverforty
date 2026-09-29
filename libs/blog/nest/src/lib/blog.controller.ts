import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import type { ContentSource } from '@fitoverforty/blog-ts';
import { CONTENT_SOURCE } from './content-source.token';
import { parsePaging } from './paging';

@Controller('blog')
export class BlogController {
  constructor(
    @Inject(CONTENT_SOURCE) private readonly content: ContentSource,
  ) {}

  @Get('posts')
  listPosts(@Query('page') page?: string, @Query('perPage') perPage?: string) {
    const { page: p, perPage: pp } = parsePaging(page, perPage);
    return this.content.listPosts(p, pp);
  }

  // Declared before 'posts/:slug', which would otherwise match 'refs' as a
  // slug and return 404 for it.
  @Get('posts/refs')
  listPublishedRefs() {
    return this.content.listPublishedRefs();
  }

  @Get('posts/:slug')
  async post(@Param('slug') slug: string) {
    const post = await this.content.loadPost(slug);
    if (!post) {
      // A draft, a future-dated post and a typo are all 404 here on purpose:
      // distinguishing them would leak the existence of unpublished content.
      throw new NotFoundException(`No published post with slug "${slug}"`);
    }
    return post;
  }

  /**
   * Where a reader goes after finishing this post.
   *
   * A separate route rather than a field on the post: it is only needed once
   * the body has been read, the post payload is already the largest thing the
   * API serves, and a listing page has no use for it.
   */
  @Get('posts/:slug/related')
  related(@Param('slug') slug: string, @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '', 10);
    // Clamped rather than trusted: the limit is a take on a public query.
    const take = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), 6)
      : 3;
    return this.content.relatedPosts(slug, take);
  }

  @Get('pillars')
  listPillars() {
    return this.content.listPillars();
  }

  @Get('pillars/:slug/posts')
  postsByPillar(
    @Param('slug') slug: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    const { page: p, perPage: pp } = parsePaging(page, perPage);
    return this.content.postsByPillar(slug, p, pp);
  }

  @Get('tags')
  listTags() {
    return this.content.listTags();
  }

  @Get('tags/:slug/posts')
  postsByTag(
    @Param('slug') slug: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    const { page: p, perPage: pp } = parsePaging(page, perPage);
    return this.content.postsByTag(slug, p, pp);
  }
}
