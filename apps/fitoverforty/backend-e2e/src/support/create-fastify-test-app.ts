import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

/**
 * A user to treat every request as coming from.
 *
 * See {@link createFastifyTestApp} for why this exists rather than signing in.
 */
export interface FakeSessionUser {
  id: string;
  email: string;
  name: string;
}

export interface TestAppOptions {
  /**
   * Replaces the Better Auth instance with one that always returns this user.
   *
   * `better-auth` is ESM-only and mapped to a throwing stub in these CommonJS
   * suites — see `apps/fitoverforty/test-stubs/README.md` — so there is no
   * sign-in to perform here, and without an override every guarded route
   * answers 500 rather than anything meaningful.
   *
   * The trade is stated rather than hidden: these suites test what the
   * authoring API does *given* a session, and prove nothing about how a session
   * is established. That half is `fitoverforty-frontend-e2e`, which drives a
   * real built server through a real browser sign-in.
   *
   * Pass `null` to override with an auth instance that has no session, which
   * is how a test asserts the guard rejects an unauthenticated request — the
   * loud stub would answer 500 there, which proves nothing about the guard.
   * Omit the key entirely to leave the stub in place.
   */
  signedInAs?: FakeSessionUser | null;

  /**
   * Where the social-card renderer should find its fonts and WASM.
   *
   * `OgModule` defaults to `join(__dirname, 'assets')`, which is correct for
   * the built artefact and wrong here: these suites run from source, where
   * that directory does not exist. A suite that exercises an `/og` route
   * prepares a directory the way `webpack.config.js` lays one out and passes
   * it; everything else leaves this alone, because a module that is never
   * asked for a card never reads the files.
   */
  ogAssetDir?: string;
}

export async function createFastifyTestApp(
  options: TestAppOptions = {},
): Promise<NestFastifyApplication> {
  // E2E tests should not depend on external SMTP services.
  process.env.FORMS_MAILER_PROVIDER = 'noop';

  // Migrations are applied once by global-setup, before any worker starts.
  // eslint-disable-next-line @nx/enforce-module-boundaries
  const { AppModule } = await import('../../../backend/src/app/app.module');
  const { AUTH_INSTANCE } = await import('@fitoverforty/auth-nest');

  let builder: TestingModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  // `in` rather than a truthiness check: `null` is a meaningful value here,
  // and means "override, with nobody signed in".
  if ('signedInAs' in options) {
    const user = options.signedInAs ?? null;
    builder = builder.overrideProvider(AUTH_INSTANCE).useValue({
      // Only what AdminGuard calls. Anything else still reaches the loud stub,
      // so a route that starts using more of Better Auth fails here loudly
      // rather than passing against a fake.
      api: { getSession: async () => (user ? { user } : null) },
    });
  }

  if (options.ogAssetDir) {
    const { OG_ASSET_DIR } = await import('@fitoverforty/og-nest');
    builder = builder.overrideProvider(OG_ASSET_DIR).useValue(options.ogAssetDir);
  }

  const moduleFixture = await builder.compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
