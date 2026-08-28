import { TestBed } from '@angular/core/testing';
import {
  Router,
  UrlTree,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { provideRouter } from '@angular/router';
import { adminGuard, signedOutGuard } from './admin.guard';
import { AuthService, type AuthStatus } from './auth.service';

function fakeAuth(initial: AuthStatus, resolved: AuthStatus = initial) {
  let current = initial;
  return {
    status: () => current,
    refresh: async () => {
      current = resolved;
      return resolved;
    },
    refreshCalls: () => current,
  } as unknown as AuthService;
}

function run(
  guard: typeof adminGuard,
  auth: AuthService,
  url = '/admin/posts/new',
) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
  return TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  ) as Promise<boolean | UrlTree>;
}

describe('adminGuard', () => {
  it('admits a signed-in visitor', async () => {
    await expect(run(adminGuard, fakeAuth('signed-in'))).resolves.toBe(true);
  });

  it('asks the server when the status is unknown', async () => {
    // The cookie can expire while a tab sits open, so a cold guard has to read
    // the session rather than assume the last known state still holds.
    await expect(
      run(adminGuard, fakeAuth('unknown', 'signed-in')),
    ).resolves.toBe(true);
  });

  it('redirects a signed-out visitor to sign-in', async () => {
    const result = await run(adminGuard, fakeAuth('signed-out'));
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toContain(
      '/admin/sign-in',
    );
  });

  it('carries the requested URL so a deep link survives sign-in', async () => {
    const result = await run(
      adminGuard,
      fakeAuth('signed-out'),
      '/admin/posts/new',
    );
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toContain(
      'returnUrl=%2Fadmin%2Fposts%2Fnew',
    );
  });
});

describe('signedOutGuard', () => {
  it('lets a signed-out visitor see the form', async () => {
    await expect(run(signedOutGuard, fakeAuth('signed-out'))).resolves.toBe(
      true,
    );
  });

  it('sends a signed-in visitor to the dashboard', async () => {
    const result = await run(signedOutGuard, fakeAuth('signed-in'));
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/admin',
    );
  });
});
