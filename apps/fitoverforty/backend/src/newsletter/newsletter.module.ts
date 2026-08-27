import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsletterConsentEntity } from './entities/newsletter-consent.entity';
import { LoggingSubscriberAdapter } from './logging-subscriber.adapter';
import { MailerLiteSubscriberAdapter } from './mailerlite-subscriber.adapter';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { SUBSCRIBER_PORT, type SubscriberPort } from './subscriber.port';

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

@Module({
  imports: [TypeOrmModule.forFeature([NewsletterConsentEntity])],
  controllers: [NewsletterController],
  providers: [
    NewsletterService,
    { provide: SUBSCRIBER_PORT, useFactory: createSubscriberPort },
  ],
})
export class NewsletterModule {}
