import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Whether this row records an agreement or its withdrawal. */
export type ConsentKind = 'granted' | 'withdrawn';

/**
 * One event in the consent history of an address.
 *
 * Kept locally rather than relying on MailerLite's own record: under UK GDPR
 * the controller has to be able to evidence consent, and an ESP's export stops
 * being ours the moment we change provider.
 *
 * Append-only by design. Re-subscribing is a new act of consent and
 * unsubscribing is a new act of withdrawal; both are new rows. The current
 * state of an address is the newest row for it, never a column somebody
 * overwrote.
 */
@Entity({ schema: 'newsletter', name: 'consents' })
@Index('idx_consents_email', ['email'])
export class NewsletterConsentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text', default: 'granted' })
  kind!: ConsentKind;

  /**
   * Wording version, and the exact wording, as shown at the time.
   *
   * Null on a withdrawal: nobody was shown a form, so there is no wording to
   * evidence. `ck_consents_granted_has_wording` requires both on a grant.
   */
  @Column({ type: 'text', name: 'consent_version', nullable: true })
  consentVersion!: string | null;

  @Column({ type: 'text', name: 'consent_text', nullable: true })
  consentText!: string | null;

  /** The page the subscription came from. */
  @Column({ type: 'text', name: 'source_url', nullable: true })
  sourceUrl!: string | null;

  /**
   * What told us, for events we did not observe directly — a withdrawal
   * arrives as `mailerlite:subscriber.unsubscribed`. Null on a grant, whose
   * source is the `source_url` the person submitted from.
   */
  @Column({ type: 'text', name: 'event_source', nullable: true })
  eventSource!: string | null;

  /**
   * Idempotency key for provider events, unique where present.
   *
   * Providers retry; a retry must not read as a second withdrawal. Null for
   * rows written by the subscribe path, and NULLs are distinct in the unique
   * index, so those never collide.
   */
  @Column({ type: 'text', name: 'dedupe_key', nullable: true })
  dedupeKey!: string | null;

  /**
   * Nullable because a request can arrive without a usable client address,
   * and refusing consent in that case would be worse than recording it
   * without one.
   */
  @Column({ type: 'inet', name: 'ip_address', nullable: true })
  ipAddress!: string | null;

  /** When we recorded the event, whichever kind it is. */
  @CreateDateColumn({ type: 'timestamptz', name: 'recorded_at' })
  recordedAt!: Date;
}
