import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminGuard, RequestWithUser } from './admin.guard';
import type { Auth } from './auth.factory';

function contextFor(request: Partial<RequestWithUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function authReturning(session: unknown): Auth {
  return {
    api: { getSession: jest.fn().mockResolvedValue(session) },
  } as unknown as Auth;
}

describe('AdminGuard', () => {
  it('rejects a request with no session', async () => {
    const guard = new AdminGuard(authReturning(null));
    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a session that carries no user', async () => {
    const guard = new AdminGuard(authReturning({ session: {} }));
    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('admits a valid session and attaches the user', async () => {
    const guard = new AdminGuard(
      authReturning({
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@example.com',
          name: 'Admin',
          image: null,
        },
      }),
    );
    const request: Partial<RequestWithUser> = { headers: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@example.com',
      name: 'Admin',
    });
  });

  it('forwards the cookie header, which is the only thing carrying the session', async () => {
    const auth = authReturning(null);
    const guard = new AdminGuard(auth);

    await expect(
      guard.canActivate(contextFor({ headers: { cookie: 'session=abc' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const headers = (auth.api.getSession as unknown as jest.Mock).mock
      .calls[0][0].headers as Headers;
    expect(headers.get('cookie')).toBe('session=abc');
  });
});
