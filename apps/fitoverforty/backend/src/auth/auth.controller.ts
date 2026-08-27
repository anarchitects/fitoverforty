import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Auth } from './auth.factory';
import { AUTH_INSTANCE } from './auth.tokens';
import { sendWebResponse, toWebRequest } from './fastify-web';

/**
 * Hands every `/api/auth/*` request to Better Auth.
 *
 * Better Auth owns its own routing, so this deliberately does not enumerate
 * sign-in, sign-out and the rest — enumerating them would mean this list
 * drifting out of step with the library on every upgrade.
 */
@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: Auth) {}

  @All('*')
  async handle(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const response = await this.auth.handler(toWebRequest(request));
    await sendWebResponse(reply, response);
  }
}
