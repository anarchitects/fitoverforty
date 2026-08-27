import { Injectable, Logger } from '@nestjs/common';
import type { SubscriberPort, SubscribeRequest } from './subscriber.port';

/**
 * Used when no ESP is configured.
 *
 * Consent is still recorded, so local development and the e2e suite exercise
 * the real path; only the call to the provider is replaced. It logs loudly
 * rather than silently succeeding, because a production deployment that
 * reaches this has an unconfigured newsletter.
 */
@Injectable()
export class LoggingSubscriberAdapter implements SubscriberPort {
  private readonly logger = new Logger(LoggingSubscriberAdapter.name);

  async subscribe(request: SubscribeRequest): Promise<void> {
    this.logger.warn(
      `No ESP configured; not subscribing <${request.email}>. ` +
        'Set MAILERLITE_API_KEY and MAILERLITE_GROUP_ID to deliver.',
    );
  }
}
