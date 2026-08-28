import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminPost,
  AdminPostSummary,
} from '@fitoverforty/blog-ts';
import { AdminGuard, CurrentUser } from '../../auth';
import type { AuthenticatedUser } from '../../auth';
import { PostAdminService } from './post-admin.service';
import { parseDraftBody, parsePublishBody } from './post-write.request';

/**
 * The authoring API.
 *
 * Guarded at the class level rather than per handler: a write endpoint added
 * here later must be protected by default, and remembering a decorator is not
 * a security control.
 */
@Controller('admin/posts')
@UseGuards(AdminGuard)
export class PostAdminController {
  constructor(private readonly posts: PostAdminService) {}

  @Get()
  list(): Promise<AdminPostSummary[]> {
    return this.posts.list();
  }

  @Get(':id')
  load(@Param('id', ParseUUIDPipe) id: string): Promise<AdminPost> {
    return this.posts.load(id);
  }

  @Post()
  create(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<AdminPost> {
    // The guard sets this and throws when it cannot, so reaching here without
    // a user means the guard was removed. Failing loudly beats attributing a
    // post to nobody.
    if (!user) throw new UnauthorizedException('Sign in to continue.');
    return this.posts.create(parseDraftBody(body), user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<AdminPost> {
    return this.posts.update(id, parseDraftBody(body));
  }

  /**
   * Publish, or schedule by passing a future `publishedAt`.
   *
   * 200 rather than 201: this changes a post that already exists, and the
   * response is that post rather than a new resource.
   */
  @Post(':id/publish')
  @HttpCode(200)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<AdminPost> {
    return this.posts.publish(id, parsePublishBody(body).publishedAt);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id', ParseUUIDPipe) id: string): Promise<AdminPost> {
    return this.posts.unpublish(id);
  }
}
