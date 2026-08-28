import {
  AddValidationRulesToFormConfigs1720310000000,
  CreateFormsTables1720300000000,
  FormConfigEntity,
  SubmissionEntity,
} from '@anarchitects/forms-nest/infrastructure-persistence';
import { ContactForm1774554775527 } from '../tools/typeorm/migrations/1774554775527-ContactForm';
import { CreateBlogSchema1787753192528 } from '../tools/typeorm/migrations/1787753192528-CreateBlogSchema';
import { SeedBlogContent1787754605505 } from '../tools/typeorm/migrations/1787754605505-SeedBlogContent';
import { CreateNewsletterSchema1787784560093 } from '../tools/typeorm/migrations/1787784560093-CreateNewsletterSchema';
import { CreateAuthSchema1787822337235 } from '../tools/typeorm/migrations/1787822337235-CreateAuthSchema';
import { LinkAuthorsToUsers1787840262133 } from '../tools/typeorm/migrations/1787840262133-LinkAuthorsToUsers';
import { RecordConsentWithdrawal1787871010736 } from '../tools/typeorm/migrations/1787871010736-RecordConsentWithdrawal';
import { NewsletterConsentEntity } from './newsletter/entities/newsletter-consent.entity';
import {
  AuthAccountEntity,
  AuthSessionEntity,
  AuthUserEntity,
  AuthVerificationEntity,
} from './auth/entities';
import {
  AuthorEntity,
  MediaEntity,
  PostEntity,
  TagEntity,
} from './blog/entities';
import { DataSource } from 'typeorm';
import type { LoggerOptions } from 'typeorm';

/**
 * What TypeORM logs, defaulting to the parts worth reading.
 *
 * This was `true` — every query, on every connection. That made a CI run carry
 * the whole query stream, and finding an actual failure in it meant scrolling
 * past thousands of successful SELECTs. It was tolerated while the schema was
 * moving and the firehose was more useful than annoying; it stopped being a
 * good trade once the schema settled.
 *
 * `error` is kept deliberately and is not negotiable: TypeORM logs the failing
 * SQL and its parameters at that level, which is what makes a broken migration
 * diagnosable at all. `migration` keeps the "has been executed successfully"
 * lines that make a deploy legible.
 *
 * Set `TYPEORM_LOGGING=all` to get the firehose back for a debugging session,
 * or a comma-separated list of TypeORM's own levels — `query,error` — for
 * something in between.
 */
function loggingOption(): LoggerOptions {
  const configured = process.env.TYPEORM_LOGGING?.trim();
  if (!configured) return ['error', 'warn', 'migration'];
  if (configured === 'all') return 'all';
  if (configured === 'false' || configured === 'none') return false;
  return configured.split(',').map((level) => level.trim()) as LoggerOptions;
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.TYPEORM_HOST ?? 'localhost',
  port: Number.parseInt(process.env.TYPEORM_PORT ?? '5432', 10) || 5432,
  username: process.env.TYPEORM_USERNAME ?? 'fitoverforty',
  password: process.env.TYPEORM_PASSWORD ?? 'fitoverforty',
  database: process.env.TYPEORM_DATABASE ?? 'fitoverforty',
  schema: process.env.TYPEORM_SCHEMA ?? 'public',
  ssl: process.env.TYPEORM_SSL === 'true',
  applicationName:
    process.env.TYPEORM_APPLICATION_NAME ?? 'fitoverforty_backend-service',
  connectTimeoutMS:
    Number.parseInt(process.env.TYPEORM_CONNECT_TIMEOUT_MS ?? '5000', 10) ||
    5000,
  synchronize: false,
  logging: loggingOption(),
  entities: [
    FormConfigEntity,
    SubmissionEntity,
    PostEntity,
    TagEntity,
    AuthorEntity,
    MediaEntity,
    NewsletterConsentEntity,
    AuthUserEntity,
    AuthAccountEntity,
    AuthSessionEntity,
    AuthVerificationEntity,
  ],
  migrations: [
    CreateFormsTables1720300000000,
    AddValidationRulesToFormConfigs1720310000000,
    ContactForm1774554775527,
    CreateBlogSchema1787753192528,
    SeedBlogContent1787754605505,
    CreateNewsletterSchema1787784560093,
    CreateAuthSchema1787822337235,
    LinkAuthorsToUsers1787840262133,
    RecordConsentWithdrawal1787871010736,
  ],
});

export function makeRuntimeDataSource(): DataSource {
  return new DataSource(AppDataSource.options);
}
