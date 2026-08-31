import { createBetterAuthTypeormAdapter } from '@anarchitects/better-auth-typeorm-adapter';
import { betterAuth } from 'better-auth';
import type { DataSource } from 'typeorm';
import {
  AuthAccountEntity,
  AuthSessionEntity,
  AuthUserEntity,
  AuthVerificationEntity,
} from './entities';

/**
 * Where Better Auth's own routes live.
 *
 * This has to include the `api` global prefix. Better Auth builds its
 * redirect and cookie paths from `basePath`, so a value that disagrees with
 * where Nest actually mounted the controller produces a sign-in that appears
 * to succeed and then bounces the browser to a 404.
 */
export const AUTH_BASE_PATH = '/api/auth';

/**
 * Reads the signing secret, refusing to start without one.
 *
 * There is no development default on purpose. The secret is what makes a
 * session cookie unforgeable, so a placeholder would mean anyone who has read
 * the repository can mint an admin session — the failure would be silent, and
 * it would be a real compromise rather than an outage. `MAILER_*` having
 * placeholder defaults is already a documented trap in CLAUDE.md; this is the
 * same mistake with a much worse blast radius.
 */
function requireSecret(): string {
  const secret = process.env['BETTER_AUTH_SECRET'];
  if (!secret || secret.length < 32) {
    throw new Error(
      'BETTER_AUTH_SECRET must be set to at least 32 characters. ' +
        'Generate one with: openssl rand -base64 32',
    );
  }
  return secret;
}

/**
 * Reads the site's public origin, refusing to start without one.
 *
 * Required rather than defaulted, for the same reason as the secret above.
 * This value is the only entry in `trustedOrigins`, so a development default
 * would mean a deployed instance permanently trusting `http://localhost:4200`
 * as an origin allowed to drive the admin login — which is what it used to do,
 * because setting `SITE_URL` *added* the real origin without ever removing the
 * placeholder. Anything answering on the victim's own machine could then reach
 * these endpoints with their cookies attached.
 *
 * It is also `baseURL`, so an unset value previously meant a deployment
 * minting session cookies and redirect targets against a localhost base while
 * appearing to boot cleanly. Failing here makes that an outage instead of a
 * silent misconfiguration.
 */
function requireSiteUrl(): string {
  const url = process.env['SITE_URL'];
  if (!url) {
    throw new Error(
      'SITE_URL must be set to the origin this site is served from ' +
        '(http://localhost:4200 in development). It is the only trusted ' +
        'origin for the auth endpoints and the base for session cookies.',
    );
  }
  return url.replace(/\/+$/, '');
}

/**
 * Builds the Better Auth instance over the app's existing TypeORM connection.
 *
 * The model map keys must match the `modelName` values below — the adapter
 * looks entities up by Better Auth's model name, not by class.
 */
export interface CreateAuthOptions {
  /**
   * Opens the sign-up path. Only `tools/create-admin.ts` sets this, and only
   * in its own short-lived in-process instance — it is never true for the
   * instance that serves HTTP. Provisioning through Better Auth's own sign-up
   * is what guarantees the stored hash matches what sign-in will later verify
   * against; a hash written any other way is a hash nobody can reproduce.
   */
  allowSignUp?: boolean;
}

export function createAuth(
  dataSource: DataSource,
  options: CreateAuthOptions = {},
) {
  const siteUrl = requireSiteUrl();
  return betterAuth({
    appName: 'fitoverforty',
    baseURL: siteUrl,
    basePath: AUTH_BASE_PATH,
    secret: requireSecret(),
    /**
     * Exactly one origin. Better Auth rejects cross-origin sign-in attempts
     * from anywhere not listed, which is what stops another site from driving
     * the admin login with a victim's cookies — so every extra entry is
     * another site allowed to try.
     */
    trustedOrigins: [siteUrl],
    database: createBetterAuthTypeormAdapter({
      dataSource,
      models: {
        users: AuthUserEntity,
        accounts: AuthAccountEntity,
        sessions: AuthSessionEntity,
        verifications: AuthVerificationEntity,
      },
    }),
    advanced: {
      database: { generateId: 'uuid' },
    },
    user: { modelName: 'users' },
    account: { modelName: 'accounts' },
    session: { modelName: 'sessions' },
    verification: { modelName: 'verifications' },
    /**
     * Two accounts, created out of band. `disableSignUp` closes the public
     * registration route outright rather than merely leaving it unlinked —
     * §9 of the spec asks for the path to be disabled, and an unlinked route
     * is still a route.
     */
    emailAndPassword: {
      enabled: true,
      disableSignUp: !options.allowSignUp,
      minPasswordLength: 12,
    },
  });
}

/**
 * The configured Better Auth instance.
 *
 * Derived from `createAuth` rather than written as `ReturnType<typeof
 * betterAuth>`: Better Auth's return type is generic in the options object, so
 * the general form is not assignable from the specific one this app builds,
 * and annotating `createAuth` with it fails to compile.
 */
export type Auth = ReturnType<typeof createAuth>;
