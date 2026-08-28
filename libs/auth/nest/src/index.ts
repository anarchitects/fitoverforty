export { AdminGuard } from './lib/admin.guard';
export type { AuthenticatedUser, RequestWithUser } from './lib/admin.guard';
export { AuthModule } from './lib/auth.module';
export { AUTH_BASE_PATH, createAuth } from './lib/auth.factory';
export type { Auth } from './lib/auth.factory';
export { AUTH_INSTANCE } from './lib/auth.tokens';
export { CurrentUser } from './lib/current-user.decorator';

/**
 * The entities are exported because `data-source.ts` in the app composes them
 * into the DataSource — the app owns the connection, the domain owns the shape.
 */
export {
  AuthAccountEntity,
  AuthSessionEntity,
  AuthUserEntity,
  AuthVerificationEntity,
} from './lib/entities';
