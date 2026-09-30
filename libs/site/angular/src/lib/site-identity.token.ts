import { InjectionToken, type Provider } from '@angular/core';
import { type SiteIdentity } from '@fitoverforty/site-ts';

/**
 * The site's identity, for components.
 *
 * A separate token from the `Symbol` in `@fitoverforty/site-ts` because an
 * Angular `InjectionToken` needs `@angular/core`, and that library is imported
 * by the backend. They carry the same value and share a name; no consumer sees
 * both.
 *
 * No default. A factory returning this application's identity would make every
 * library work without being configured and then quietly render the wrong
 * site's name in the next one — the exact failure this whole change exists to
 * remove. Missing configuration fails at injection instead, which is loud and
 * happens once.
 */
export const SITE_IDENTITY = new InjectionToken<SiteIdentity>('SITE_IDENTITY');

/** Provides the site's identity to every component that asks for it. */
export function provideSiteIdentity(identity: SiteIdentity): Provider {
  return { provide: SITE_IDENTITY, useValue: identity };
}
