import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser, RequestWithUser } from './admin.guard';

/**
 * The user {@link AdminGuard} attached to the request.
 *
 * Only meaningful on a handler behind that guard; without it there is no user
 * and this is `undefined`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
    context.switchToHttp().getRequest<RequestWithUser>().user,
);
