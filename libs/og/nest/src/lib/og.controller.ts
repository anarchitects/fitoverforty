import { Controller, Get, NotFoundException, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { siteOrigin } from '@fitoverforty/blog-nest';
import { OgService } from './og.service';

/**
 * `:file` rather than a `:slug.png` route.
 *
 * Nest 11 matches paths with path-to-regexp v8, where a parameter is greedy up
 * to the next `/` — so `:slug.png` and a slug containing a dot disagree about
 * where the parameter ends. Taking the whole segment and checking the suffix
 * here keeps the routing dull and the rule visible.
 */
const PNG_SEGMENT = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.png$/;

/**
 * A card is derived entirely from content the site already serves publicly, so
 * there is nothing here to guard — but it is not free to produce, which is why
 * `OgService` caches and why this sets a long `max-age`.
 */
@Controller()
export class OgController {
  constructor(private readonly og: OgService) {}

  @Get('og/site.png')
  async site(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    send(reply, await this.og.forSite(kickerFor(request)));
  }

  @Get('og/blog/:file')
  async post(
    @Param('file') file: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const slug = PNG_SEGMENT.exec(file)?.[1];
    if (!slug) throw new NotFoundException();

    const png = await this.og.forPost(slug, kickerFor(request));
    if (!png) throw new NotFoundException();

    send(reply, png);
  }
}

/** The bare hostname, printed in the card's bottom-right corner. */
function kickerFor(request: FastifyRequest): string {
  try {
    return new URL(siteOrigin(request)).host;
  } catch {
    return '';
  }
}

function send(reply: FastifyReply, png: Buffer): void {
  reply
    .header('content-type', 'image/png')
    .header('x-content-type-options', 'nosniff')
    /**
     * An hour, and deliberately not `immutable`: the URL carries only the
     * slug, so editing a post's title has to be able to change what this
     * returns. Scrapers cache far more aggressively than this anyway — the
     * header mostly governs the proxy in front of the app.
     */
    .header('cache-control', 'public, max-age=3600')
    .send(png);
}
