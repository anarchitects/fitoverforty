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
import { NewsletterConsentEntity } from './newsletter/entities/newsletter-consent.entity';
import {
  AuthorEntity,
  MediaEntity,
  PostEntity,
  TagEntity,
} from './blog/entities';
import { DataSource } from 'typeorm';

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
  logging: true,
  entities: [
    FormConfigEntity,
    SubmissionEntity,
    PostEntity,
    TagEntity,
    AuthorEntity,
    MediaEntity,
    NewsletterConsentEntity,
  ],
  migrations: [
    CreateFormsTables1720300000000,
    AddValidationRulesToFormConfigs1720310000000,
    ContactForm1774554775527,
    CreateBlogSchema1787753192528,
    SeedBlogContent1787754605505,
    CreateNewsletterSchema1787784560093,
  ],
});

export function makeRuntimeDataSource(): DataSource {
  return new DataSource(AppDataSource.options);
}
