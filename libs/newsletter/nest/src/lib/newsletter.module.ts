import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsletterConsentEntity } from './entities/newsletter-consent.entity';
import { LoggingSubscriberAdapter } from './logging-subscriber.adapter';
import { MailerLiteSubscriberAdapter } from './mailerlite-subscriber.adapter';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { RawBodyParser } from './raw-body';
import { SUBSCRIBER_PORT, type SubscriberPort } from './subscriber.port';
import { NewsletterWebhookController } from './webhook.controller';
import { WEBHOOK_SECRET } from './webhook.tokens';
import { WithdrawalService } from './withdrawal.service';

/**
 * Chooses the ESP adapter from the environment.
 *
 * Unset means disabled, and says so. Half-set throws at boot rather than at
 * the first subscription — the opposite of the mailer gotcha in CLAUDE.md,
 * where placeholder defaults mean an unconfigured app looks fine until someone
 * actually submits something.
 */
export function createSubscriberPort(): SubscriberPort {
  const apiKey = process.env['MAILERLITE_API_KEY'];
  const groupId = process.env['MAILERLITE_GROUP_ID'];

  if (!apiKey && !groupId) {
    new Logger('NewsletterModule').warn(
      'MAILERLITE_API_KEY and MAILERLITE_GROUP_ID are unset: consent will be ' +
        'recorded but nobody will be subscribed.',
    );
    return new LoggingSubscriberAdapter();
  }

  if (!apiKey || !groupId) {
    throw new Error(
      'Newsletter is half-configured: set both MAILERLITE_API_KEY and ' +
        'MAILERLITE_GROUP_ID, or neither.',
    );
  }

  return new MailerLiteSubscriberAdapter({
    apiKey,
    groupId,
    apiUrl: process.env['MAILERLITE_API_URL'],
  });
}

/**
 * The webhook's signing secret, or null when it is not deployed.
 *
 * Null rather than throwing at boot, unlike the API key above. The webhook is
 * an inbound endpoint MailerLite has to be pointed at from their UI, so an
 * app can be correctly configured for sending and not yet receiving. The
 * controller answers 503 in that state, which is honest and retryable; making
 * the whole app refuse to start would be a worse trade.
 */
export function createWebhookSecret(): string | null {
  const secret = process.env['MAILERLITE_WEBHOOK_SECRET'];
  if (!secret) {
    new Logger('NewsletterModule').warn(
      'MAILERLITE_WEBHOOK_SECRET is unset: unsubscribes will not be mirrored ' +
        'into the consent log, and the webhook will answer 503.',
    );
    return null;
  }
  return secret;
}

@Module({
  imports: [TypeOrmModule.forFeature([NewsletterConsentEntity])],
  controllers: [NewsletterController, NewsletterWebhookController],
  providers: [
    NewsletterService,
    WithdrawalService,
    RawBodyParser,
    { provide: SUBSCRIBER_PORT, useFactory: createSubscriberPort },
    { provide: WEBHOOK_SECRET, useFactory: createWebhookSecret },
  ],
})
export class NewsletterModule {}
