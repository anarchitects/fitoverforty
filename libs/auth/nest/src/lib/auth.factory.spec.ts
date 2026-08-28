import type { DataSource } from 'typeorm';
import { AUTH_BASE_PATH, createAuth } from './auth.factory';

/**
 * `better-auth` is stubbed here — see apps/fitoverforty/test-stubs/README.md.
 * The stub returns the options it was given, so what these tests can check is
 * the configuration this app hands to Better Auth, which is exactly where the
 * decisions that matter live.
 */
const dataSource = {} as DataSource;

function optionsOf(auth: unknown): Record<string, never> {
  return (auth as { options: Record<string, never> }).options;
}

describe('createAuth', () => {
  const original = process.env['BETTER_AUTH_SECRET'];

  afterEach(() => {
    process.env['BETTER_AUTH_SECRET'] = original;
  });

  it('refuses to build without a secret', () => {
    delete process.env['BETTER_AUTH_SECRET'];
    expect(() => createAuth(dataSource)).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('refuses a secret short enough to be guessable', () => {
    process.env['BETTER_AUTH_SECRET'] = 'too-short';
    expect(() => createAuth(dataSource)).toThrow(/32 characters/);
  });

  it('disables sign-up by default', () => {
    const options = optionsOf(createAuth(dataSource));
    expect(options['emailAndPassword']).toMatchObject({
      enabled: true,
      disableSignUp: true,
    });
  });

  /** Only the provisioning script opens this, and only in its own process. */
  it('opens sign-up only when explicitly asked', () => {
    const options = optionsOf(createAuth(dataSource, { allowSignUp: true }));
    expect(options['emailAndPassword']).toMatchObject({ disableSignUp: false });
  });

  /**
   * The base path has to include the `api` global prefix. If it does not,
   * Better Auth builds cookie and redirect paths that disagree with where Nest
   * mounted the controller, and sign-in appears to succeed then 404s.
   */
  it('mounts under the api prefix', () => {
    expect(AUTH_BASE_PATH).toBe('/api/auth');
    expect(optionsOf(createAuth(dataSource))['basePath']).toBe('/api/auth');
  });

  it('trusts the configured site origin', () => {
    process.env['SITE_URL'] = 'https://fitoverforty.co.uk/';
    const options = optionsOf(createAuth(dataSource));
    expect(options['trustedOrigins']).toContain('https://fitoverforty.co.uk');
    delete process.env['SITE_URL'];
  });
});
