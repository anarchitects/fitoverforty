import { FIT_OVER_FORTY, type SiteIdentity } from './site-identity';

/**
 * The interface is what stops a second site omitting a field; the compiler
 * does that and needs no test. What it cannot catch is a field that is present
 * and wrong — an empty string, or an address with the `@` missing — and every
 * one of these values is rendered somewhere a reader will see it, or put in a
 * `mailto:` they will click.
 */
describe('site identity', () => {
  const identities: readonly [string, SiteIdentity][] = [
    ['FIT_OVER_FORTY', FIT_OVER_FORTY],
  ];

  for (const [label, identity] of identities) {
    describe(label, () => {
      it('has a name and a description, neither of them blank', () => {
        // Trimmed, because a value of ' ' renders as nothing and passes a
        // truthiness check.
        expect(identity.name.trim().length).toBeGreaterThan(0);
        expect(identity.description.trim().length).toBeGreaterThan(0);
      });

      it('has a contact address that could actually be written to', () => {
        expect(identity.contactEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });

      it('gives the name in normal case, not shouted', () => {
        // The social card uppercases it at the point of use. If this value
        // were already uppercase, everywhere else would shout too — and the
        // card would have no way to tell the difference.
        expect(identity.name).not.toBe(identity.name.toUpperCase());
      });
    });
  }
});
