import { Injectable, type OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { FastifyInstance } from 'fastify';

/**
 * Whether this instance wants to be in search results.
 *
 * Off unless `ALLOW_INDEXING` is exactly `true`, and the default direction is
 * the decision. Staging and production serve identical content under two
 * hostnames, and staging emits its own `<link rel="canonical">` pointing at
 * itself — so left to itself it does not merely get crawled, it presents
 * itself to a crawler as the authoritative copy of the site. Two of those
 * competing is a problem that is slow to notice and slower to undo.
 *
 * Defaulting off means a *new* environment is quiet until someone says
 * otherwise, and the environment that has to remember the variable is the one
 * being set up from scratch with a checklist to hand. The opposite default
 * would put the burden on every future throwaway instance instead, and the
 * cost of forgetting there is much higher than the cost of forgetting here:
 * production absent from search is visible within weeks and fixed in one line,
 * whereas a staging box in the index has already been copied into caches and
 * other people's links.
 *
 * Strictly `'true'`: anything else is off, including `'1'` and `'yes'`. A
 * variable that decides whether the site is publicly visible is not the place
 * to be generous about what someone might have meant.
 */
export function indexingAllowed(): boolean {
  return process.env['ALLOW_INDEXING'] === 'true';
}

/**
 * Sends `X-Robots-Tag: noindex, nofollow` from an instance that does not want
 * to be indexed.
 *
 * **The header, not `Disallow: /` in robots.txt, is what does the work.** The
 * two look interchangeable and are close to opposites: `Disallow` asks a
 * crawler not to *fetch* a URL, which means it never sees a `noindex` on it
 * either, so a URL discovered from a link elsewhere can still be listed. The
 * documented way to keep something out of an index is to let it be crawled and
 * answer with `noindex`. robots.txt therefore stays permissive here and merely
 * stops advertising the sitemap.
 *
 * **Registered from this module rather than from `main.ts`, deliberately** —
 * the same reason as `RawBodyParser`: the e2e suite builds `AppModule`
 * directly and never compiles `main.ts`, so anything wired there cannot be
 * tested. A header that silently stops being sent is exactly the kind of
 * regression that would go unnoticed until a staging URL turned up in a search
 * result.
 *
 * The hook is added to the root Fastify instance and so applies to responses
 * registered after it, which is what covers the server-rendered pages: SSR is
 * a plugin registered later, from `main.ts`, and the HTML it returns is the
 * only response a search engine actually cares about.
 */
@Injectable()
export class NoIndexHeader implements OnModuleInit {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  onModuleInit(): void {
    const instance =
      this.adapterHost.httpAdapter?.getInstance<FastifyInstance>();
    // Absent under a non-Fastify adapter, which nothing here uses but which a
    // unit test may substitute. Nothing to do rather than crash.
    if (!instance?.addHook) return;

    instance.addHook('onSend', (_request, reply, payload, done) => {
      // Read per response rather than captured at registration, so a test can
      // exercise both branches against one app. It is a string comparison
      // against an environment variable that does not change at runtime.
      if (!indexingAllowed()) {
        reply.header('X-Robots-Tag', 'noindex, nofollow');
      }
      done(null, payload);
    });
  }
}
