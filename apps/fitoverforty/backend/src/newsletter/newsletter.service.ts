import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CONSENT } from './consent';
import { NewsletterConsentEntity } from './entities/newsletter-consent.entity';
import { SlidingWindowRateLimiter } from './rate-limit';
import { SUBSCRIBER_PORT, type SubscriberPort } from './subscriber.port';
import { HoneypotTripped, parseSubscribeBody } from './subscribe.request';

const MAX_ATTEMPTS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

export interface SubscribeContext {
  ipAddress?: string;
  sourceUrl?: string;
}

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);
  private readonly limiter = new SlidingWindowRateLimiter(
    MAX_ATTEMPTS_PER_HOUR,
    HOUR_MS,
  );

  constructor(
    @InjectRepository(NewsletterConsentEntity)
    private readonly consents: Repository<NewsletterConsentEntity>,
    @Inject(SUBSCRIBER_PORT) private readonly subscriber: SubscriberPort,
  ) {}

  async subscribe(body: unknown, context: SubscribeContext): Promise<void> {
    let input;
    try {
      input = parseSubscribeBody(body);
    } catch (error) {
      if (error instanceof HoneypotTripped) {
        // Report success. A bot that can tell rejection from acceptance can
        // tune around the honeypot.
        this.logger.log('Honeypot tripped on a newsletter subscription');
        return;
      }
      throw error;
    }

    if (context.ipAddress && !this.limiter.tryConsume(context.ipAddress)) {
      throw new BadRequestException(
        'Too many attempts. Please try again later.',
      );
    }
    this.limiter.prune();

    // Recorded before the provider is called, and deliberately in that order.
    // A consent record with no subscriber is harmless; a subscriber with no
    // record is a person we cannot evidence consent for.
    await this.consents.save(
      this.consents.create({
        email: input.email,
        consentVersion: CONSENT.version,
        consentText: CONSENT.text,
        sourceUrl: context.sourceUrl ?? input.source ?? null,
        ipAddress: context.ipAddress ?? null,
      }),
    );

    try {
      await this.subscriber.subscribe({
        email: input.email,
        source: input.source,
      });
    } catch (error) {
      this.logger.error(
        `Newsletter delivery failed after consent was recorded: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException(
        'We could not complete your subscription just now. Please try again shortly.',
      );
    }
  }
}
