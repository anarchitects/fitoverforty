import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CONSENT } from './consent';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  /**
   * Exposes the canonical consent wording.
   *
   * Not used at runtime by the CTA, which renders its own copy so that every
   * page does not make a request. It exists so an e2e test — and anyone
   * auditing later — can prove the two agree.
   */
  @Get('consent')
  consent() {
    return { version: CONSENT.version, text: CONSENT.text };
  }

  @Post('subscribe')
  @HttpCode(202)
  async subscribe(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ): Promise<{ status: 'pending' }> {
    await this.newsletter.subscribe(body, {
      ipAddress: request.ip,
      sourceUrl: request.headers.referer,
    });

    // Always the same answer, whether the address was new, already on the list,
    // or caught by the honeypot. Anything else tells a caller who is subscribed.
    return { status: 'pending' };
  }
}
