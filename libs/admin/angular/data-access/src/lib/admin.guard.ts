import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Gate for everything under `/admin`.
 *
 * This is a convenience, not the security boundary. It decides what the
 * browser draws; the actual protection is `AdminGuard` on the Nest side, which
 * every authoring endpoint goes through. Anyone can edit their way past this
 * one and reach a screen whose API calls all return 401.
 *
 * The session is read from the server rather than trusted from local state,
 * because the cookie can expire or be revoked while a tab sits open.
 */
export const adminGuard: CanActivateFn = async (
  _route,
  state,
): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const status =
    auth.status() === 'unknown' ? await auth.refresh() : auth.status();

  if (status === 'signed-in') return true;

  /**
   * `returnUrl` is carried so that following a deep link into the admin area
   * lands where it was aimed after signing in, rather than dumping everyone on
   * the dashboard.
   */
  return router.createUrlTree(['/admin/sign-in'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * The inverse, for the sign-in page itself: someone already signed in has no
 * reason to see a sign-in form.
 */
export const signedOutGuard: CanActivateFn = async (): Promise<
  boolean | UrlTree
> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const status =
    auth.status() === 'unknown' ? await auth.refresh() : auth.status();

  return status === 'signed-in' ? router.createUrlTree(['/admin']) : true;
};
