import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A record that someone asked to be emailed, and what they were shown.
 *
 * Kept locally rather than relying on MailerLite's own record: under UK GDPR
 * the controller has to be able to evidence consent, and an ESP's export stops
 * being ours the moment we change provider.
 */
@Entity({ schema: 'newsletter', name: 'consents' })
@Index('idx_consents_email', ['email'])
export class NewsletterConsentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  email!: string;

  /** Wording version, and the exact wording, as shown at the time. */
  @Column({ type: 'text', name: 'consent_version' })
  consentVersion!: string;

  @Column({ type: 'text', name: 'consent_text' })
  consentText!: string;

  /** The page the subscription came from. */
  @Column({ type: 'text', name: 'source_url', nullable: true })
  sourceUrl!: string | null;

  /**
   * Nullable because a request can arrive without a usable client address,
   * and refusing consent in that case would be worse than recording it
   * without one.
   */
  @Column({ type: 'inet', name: 'ip_address', nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'consented_at' })
  consentedAt!: Date;
}
