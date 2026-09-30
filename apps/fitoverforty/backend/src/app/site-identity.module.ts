import { Global, Module } from '@nestjs/common';
import { FIT_OVER_FORTY, SITE_IDENTITY } from '@fitoverforty/site-ts';

/**
 * Supplies this application's identity to every library that renders it.
 *
 * **It lives in the app rather than in a library on purpose.** The feed title,
 * the social card and the rest used to hold "Fit Over Forty" as literals,
 * which is what made those libraries unusable by a second site: nothing would
 * fail to build, it would simply publish the wrong name. Naming the site is
 * the composition root's job, and this directory is the composition root — it
 * is why `@fitoverforty/blog-nest` no longer knows what this blog is called.
 *
 * `@Global()` rather than a provider on each module, because three unrelated
 * modules need it and none of them should have to import a fourth to be told
 * the site's name. It is a constant for the process's whole life, which is the
 * case `@Global()` is for.
 *
 * `FIT_OVER_FORTY` still comes from a library, which is a compromise the
 * repository's shape forces: the frontend and the backend are separate
 * projects that cannot import each other, so a library is the only place a
 * value can be shared between them without publishing it — the same reason
 * `@fitoverforty/blog-ts` holds the content contract. When a second app
 * exists, that constant moves into each composition root and the library keeps
 * only the interface.
 */
@Global()
@Module({
  providers: [{ provide: SITE_IDENTITY, useValue: FIT_OVER_FORTY }],
  exports: [SITE_IDENTITY],
})
export class SiteIdentityModule {}
