/**
 * Who the site says it is.
 *
 * Every field here is something a *second* site would have to answer
 * differently, and every field was previously a literal inside a library —
 * "Fit Over Forty" appeared about twenty times across ten of them, in the feed
 * title, the social card, the footer, the logo's default label and three admin
 * page descriptions. None of those libraries is reusable while that is true,
 * and the failure would not be a build error: a second site would simply
 * render someone else's name.
 *
 * **This is chrome and machine-readable metadata, not copy.** Page prose is
 * deliberately excluded and stays written out where it is read — see the note
 * on `FIT_OVER_FORTY` below. The test for whether something belongs here is
 * whether a second site would want the *same sentence with a different noun in
 * it*. A feed title would; "a blog about staying in decent shape when you did
 * not start yesterday" would not.
 */
export interface SiteIdentity {
  /**
   * The site's name as a reader sees it, in its normal case. Consumers that
   * want it shouted — the social card does — uppercase it themselves rather
   * than having a second field to keep in step.
   */
  readonly name: string;
  /**
   * One sentence, used where something asks the site to describe itself
   * without a page to describe: the feed's `<description>`, the default social
   * card, the home page's meta description.
   */
  readonly description: string;
  /** Where a reader is told to write to. */
  readonly contactEmail: string;
}

/**
 * Injection token for Nest.
 *
 * A `Symbol` rather than a class, matching `CONTENT_SOURCE` in
 * `@fitoverforty/blog-nest`, and defined in this framework-free library
 * precisely so it can be one: a Nest token needs no Nest import, whereas an
 * Angular `InjectionToken` needs `@angular/core`. Keeping that out of here is
 * what lets the backend import this library without pulling Angular into its
 * bundle — the same reason `@fitoverforty/blog-ts` holds the content contract.
 *
 * The Angular side has its own token in `@fitoverforty/site-angular`. They
 * share a name because no consumer ever sees both.
 */
export const SITE_IDENTITY = Symbol('SITE_IDENTITY');

/**
 * This application's answer.
 *
 * **It lives in a library rather than in an app, and that is a compromise
 * forced by the structure.** The frontend and the backend are separate
 * projects and neither can import the other, so a library is the only place
 * they can share a value without publishing one — which is exactly why
 * `@fitoverforty/blog-ts` exists.
 *
 * When there is a second application, this constant moves into each app's own
 * composition root and this library keeps only the interface and the tokens.
 * Until then, one copy here beats two copies there.
 *
 * Note what is *not* in it, both on purpose:
 *
 * - **The newsletter consent sentence.** It is duplicated between
 *   `newsletter/angular` and `newsletter/nest` deliberately, so that rendering
 *   a checkbox costs no request, and a Playwright test compares the rendered
 *   text against `GET /api/newsletter/consent` so they cannot drift. The
 *   server's copy is version-stamped and stored with every subscriber record
 *   as the evidence of what that person agreed to. Building it from a name
 *   here would let a stored record stop matching the constant it was captured
 *   from, which is the one thing a consent record must never do. A second site
 *   needs its own wording with its own version.
 * - **The About and Privacy pages.** Those are prose, and a second site's will
 *   be different sentences rather than these sentences with a substitution in
 *   them. Parameterising copy produces the worst of both: it reads as though
 *   it were written for nobody, and it still has to be rewritten.
 */
export const FIT_OVER_FORTY: SiteIdentity = {
  name: 'Fit Over Forty',
  description:
    'Training, recovery and nutrition for people who did not start yesterday.',
  contactEmail: 'info@fitoverforty.blog',
};
