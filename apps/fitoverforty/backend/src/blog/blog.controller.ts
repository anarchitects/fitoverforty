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
