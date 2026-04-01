import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

export async function createFastifyTestApp(): Promise<NestFastifyApplication> {
  // E2E tests should not depend on external SMTP services.
  process.env.FORMS_MAILER_PROVIDER = 'noop';

  // eslint-disable-next-line @nx/enforce-module-boundaries
  const { makeRuntimeDataSource } = await import('../../../backend/src/data-source');
  const migrationDataSource = makeRuntimeDataSource();
  await migrationDataSource.initialize();
  await migrationDataSource.runMigrations();
  await migrationDataSource.destroy();

  // eslint-disable-next-line @nx/enforce-module-boundaries
  const { AppModule } = await import('../../../backend/src/app/app.module');

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
