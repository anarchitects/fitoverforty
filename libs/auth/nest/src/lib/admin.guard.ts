import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Auth } from './auth.factory';
import { AUTH_INSTANCE } from './auth.tokens';

/** The authenticated user, as attached to the request by {@link AdminGuard}. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface RequestWithUser extends FastifyRequest {
  user?: AuthenticatedUser;
}

/**
 * Requires a valid session.
 *
 * Every account in this app is an admin — §9 specifies two accounts and no
 * public registration — so there is no role check to make. If that ever stops
 * being true, this is the one place that has to learn about roles.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value === undefined) continue;
      headers.append(
        key,
        Array.isArray(value) ? value.join('; ') : String(value),
      );
    }

    const session = await this.auth.api.getSession({ headers });
    if (!session?.user) {
      throw new UnauthorizedException('Sign in to continue.');
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };
    return true;
  }
}
