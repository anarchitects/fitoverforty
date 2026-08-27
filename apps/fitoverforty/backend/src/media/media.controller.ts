import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
/**
 * Imported for its type augmentation, not for a value.
 *
 * `@fastify/multipart` is what adds `isMultipart()` and `file()` to
 * `FastifyRequest`. `main.ts` registers the plugin, but this file is compiled
 * without `main.ts` by the backend-e2e suite, and there those two methods do
 * not exist — every suite fails to compile, on a controller the tests never
 * call. Declaring the dependency here keeps the augmentation with the code
 * that relies on it.
 */
import '@fastify/multipart';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AdminGuard } from '../auth';
import { MAX_UPLOAD_BYTES, RejectedUploadError } from './image-rules';
import { MediaService } from './media.service';

/**
 * Keys are generated as `<uuid>.<ext>`, and nothing else is accepted.
 *
 * The storage adapter refuses to escape its root as well, so this is the outer
 * of two checks. Both are cheap and neither is redundant: this one keeps a
 * malformed request from reaching the filesystem layer at all.
 */
const KEY_PATTERN = /^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/;

@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /**
   * Accepts an image.
   *
   * Behind the admin guard: this writes to disk, and an unauthenticated write
   * endpoint is a free file host that will be found and used.
   */
  @Post('media')
  @UseGuards(AdminGuard)
  async upload(@Req() request: FastifyRequest): Promise<{
    success: 1;
    mediaId: string;
    file: { url: string; width: number; height: number };
  }> {
    if (!request.isMultipart()) {
      throw new BadRequestException('Send the image as multipart/form-data.');
    }

    const part = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!part) throw new BadRequestException('No file was sent.');

    const buffer = await part.toBuffer();
    /**
     * `toBuffer` resolves rather than throwing when the limit is hit, setting
     * this flag instead. Without the check an oversized upload is silently
     * truncated and stored as a corrupt image.
     */
    if (part.file.truncated) {
      throw new BadRequestException(
        `Images must be ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB or smaller.`,
      );
    }

    try {
      const stored = await this.media.store(buffer);
      /**
       * `success` and `file` are Editor.js's image tool's shape, which it
       * requires. `mediaId` is beside them rather than inside `file` because
       * the tool copies `file` into the block, and a `blog.media` id has no
       * business being stored in block JSON — the hero is a foreign key, and
       * a body image is just a URL. Editor.js ignores the extra key; the hero
       * picker, which posts to this same endpoint, is what reads it.
       */
      return {
        success: 1,
        mediaId: stored.id,
        file: {
          url: stored.url,
          width: stored.width,
          height: stored.height,
        },
      };
    } catch (error) {
      if (error instanceof RejectedUploadError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Serves an uploaded file.
   *
   * Public, and deliberately so — these appear in published posts. Served
   * through the app rather than by a static handler so the content-type comes
   * from what was recorded at upload, and so `nosniff` is guaranteed to be on
   * it.
   */
  @Get('media/:key')
  async serve(
    @Param('key') key: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!KEY_PATTERN.test(key)) throw new NotFoundException();

    const [bytes, mime] = await Promise.all([
      this.media.fetch(key),
      this.media.mimeFor(key),
    ]);
    if (!bytes || !mime) throw new NotFoundException();

    reply
      .header('content-type', mime)
      /**
       * Without this a browser may sniff the bytes, decide a file is HTML and
       * render it in this origin. The upload path already restricts formats,
       * so this is the second lock on the same door.
       */
      .header('x-content-type-options', 'nosniff')
      // Content is immutable: the key is a UUID and never reused.
      .header('cache-control', 'public, max-age=31536000, immutable')
      .send(bytes);
  }
}
