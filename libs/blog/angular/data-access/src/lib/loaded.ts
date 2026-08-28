/**
 * The outcome of a route resolver.
 *
 * Resolvers must not reject. Angular cancels a navigation whose resolver
 * throws, which on a first load means the browser is left on a blank page —
 * an API blip becomes a white screen. Failure is therefore a value the page
 * renders, not an exception.
 *
 * `ok: true` with empty data means "nothing published". `ok: false` means
 * "could not load", and the two must not be shown the same way: telling a
 * reader (or a crawler) that a blog is empty when the API is down is worse
 * than admitting the failure.
 */
export type Loaded<T> = { ok: true; data: T } | { ok: false };

export async function loaded<T>(work: Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await work };
  } catch (error) {
    console.error('Blog content failed to load', error);
    return { ok: false };
  }
}
