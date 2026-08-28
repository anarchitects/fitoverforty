import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { WEBHOOK_SECRET } from './webhook.tokens';
import type { RequestWithRawBody } from './raw-body';
import {
  SIGNATURE_HEADER,
  parseWithdrawalEvents,
  verifySignature,
} from './webhook.request';
import { WithdrawalService } from './withdrawal.service';

@Controller('newsletter')
export class NewsletterWebhookController {
  constructor(
    private readonly withdrawals: WithdrawalService,
    @Inject(WEBHOOK_SECRET) private readonly secret: string | null,
  ) {}

  /**
   * Mirrors MailerLite unsubscribes back into the consent log.
   *
   * Public by necessity — MailerLite has no credential to present — so the
   * signature is the entire access control. Without it this endpoint lets
   * anyone mark any address as having withdrawn consent.
   *
   * 200 with a count rather than 204: the body is what makes a delivery
   * legible in MailerLite's webhook log when somebody is working out why a
   * withdrawal did or did not land.
   */
  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Req() request: RequestWithRawBody,
    @Headers(SIGNATURE_HEADER) signature?: string,
  ): Promise<{ recorded: number; duplicates: number }> {
    if (!this.secret) {
      // Refusing beats accepting unverified events. 503 rather than 500
      // because it is a deployment gap, and it tells MailerLite to retry —
      // so events queued during a misconfiguration are not simply lost.
      throw new ServiceUnavailableException(
        'The newsletter webhook is not configured.',
      );
    }

    verifySignature(request.rawBody, signature, this.secret);

    // Parsed from the already-verified body. Nothing reaches the database
    // before the signature has been checked.
    const events = parseWithdrawalEvents(request.body);
    return this.withdrawals.record(events);
  }
}
