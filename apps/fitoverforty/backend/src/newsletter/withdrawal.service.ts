import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { NewsletterConsentEntity } from './entities/newsletter-consent.entity';
import type { WithdrawalEvent } from './webhook.request';

/** Postgres unique_violation. A retry landing on the dedupe index. */
const UNIQUE_VIOLATION = '23505';

export interface WithdrawalOutcome {
  recorded: number;
  duplicates: number;
}

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);

  constructor(
    @InjectRepository(NewsletterConsentEntity)
    private readonly consents: Repository<NewsletterConsentEntity>,
  ) {}

  async record(events: WithdrawalEvent[]): Promise<WithdrawalOutcome> {
    let recorded = 0;
    let duplicates = 0;

    for (const event of events) {
      if (await this.insert(event)) recorded++;
      else duplicates++;
    }

    if (recorded) {
      // No address in the log: this line exists to show the pipe is alive, and
      // whose consent changed is not something to scatter through log storage.
      this.logger.log(`Recorded ${recorded} newsletter withdrawal(s)`);
    }
    return { recorded, duplicates };
  }

  /**
   * Inserts one withdrawal, reporting false if it was already recorded.
   *
   * Idempotency comes from the unique index, not from a read-then-write: two
   * retries can arrive at once, and a check-then-insert would let both pass
   * the check before either wrote. Catching the violation is the only version
   * that is actually correct under concurrency.
   *
   * A withdrawal is recorded even for an address that never granted consent
   * here. MailerLite lists can be edited directly, and an unexplained
   * withdrawal is a better audit trail than a silently dropped one.
   */
  private async insert(event: WithdrawalEvent): Promise<boolean> {
    try {
      await this.consents.insert({
        email: event.email,
        kind: 'withdrawn',
        // No wording: nobody was shown a form. The check constraint requires
        // these only on a grant.
        consentVersion: null,
        consentText: null,
        sourceUrl: null,
        ipAddress: null,
        eventSource: `mailerlite:${event.event}`,
        dedupeKey: event.dedupeKey,
      });
      return true;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION
      ) {
        return false;
      }
      throw error;
    }
  }
}
