import { Injectable, type OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';

export interface RequestWithRawBody extends FastifyRequest {
  rawBody?: string;
}

/**
 * Keeps the raw JSON body for the webhook route, and only for it.
 *
 * Signing is over bytes. Fastify parses `application/json` before a handler
 * ever sees it, and `JSON.stringify(JSON.parse(x))` is not `x` — key order,
 * whitespace and number formatting all move — so an HMAC computed from the
 * parsed object would reject every genuine delivery. The only way to verify is
 * to keep what actually arrived.
 *
 * **Registered from a module rather than from `main.ts`, deliberately.** The
 * e2e suite builds `AppModule` directly and never compiles `main.ts`, so
 * anything wired there is invisible to it — which is how the `@fastify/multipart`
 * augmentation went missing in step 8. Signature verification is the last
 * thing that should be untestable, so it is wired where the tests can reach it.
 *
 * Applied to every JSON request rather than matched against the webhook's
 * path. Matching meant hard-coding `/api/newsletter/webhook`, which couples
 * this to the global prefix set in `main.ts` — and the e2e suite, which sets
 * no prefix, silently got no raw body and a 400 from every delivery. A
 * signature check that fails open when a path string drifts is not a
 * signature check. The string was already materialised by `parseAs: 'string'`,
 * so keeping a reference to it costs nothing worth the coupling.
 */
@Injectable()
export class RawBodyParser implements OnModuleInit {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  onModuleInit(): void {
    const instance = this.adapterHost.httpAdapter?.getInstance<FastifyInstance>();
    // Absent under a non-Fastify adapter, which nothing here uses but which a
    // unit test may substitute. Nothing to do rather than crash.
    if (!instance?.addContentTypeParser) return;

    /**
     * Fastify refuses to overwrite a parser — `addContentTypeParser` throws
     * "already present" — and Nest's adapter installs its own JSON parser
     * during bootstrap. So the existing one is removed rather than replaced.
     *
     * What goes back is the same behaviour plus the raw string, so every other
     * JSON route is unaffected; the e2e suite asserts that directly, because
     * silently breaking every POST in the app is the plausible failure here.
     */
    instance.removeContentTypeParser('application/json');

    /**
     * Fastify's own parser, not `JSON.parse`.
     *
     * `getDefaultJsonParser` wraps `secure-json-parse`, which rejects
     * `__proto__` and `constructor.prototype` in the payload. Nest opts into
     * that deliberately — its adapter builds the parser as
     * `getDefaultJsonParser(onProtoPoisoning || 'error', onConstructorPoisoning
     * || 'error')` — so reimplementing this with a bare `JSON.parse` quietly
     * dropped the protection from *every* JSON route in the app, authenticated
     * or not. Delegating keeps it, and keeps this parser honest about being
     * "the same behaviour plus the raw string".
     */
    const { onProtoPoisoning, onConstructorPoisoning } = instance.initialConfig;
    const parseJson = instance.getDefaultJsonParser(
      onProtoPoisoning ?? 'error',
      onConstructorPoisoning ?? 'error',
    );

    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (request, body, done) => {
        const raw = body as string;
        (request as RequestWithRawBody).rawBody = raw;

        /**
         * A deliberate divergence from Fastify, which answers 400
         * `FST_ERR_CTP_EMPTY_JSON_BODY` here. `POST /admin/posts/:id/publish`
         * treats a missing body as "publish this, now" — see
         * `parsePublishBody` — so an empty body has to reach the handler
         * rather than die at the parser.
         *
         * This comment previously claimed to match Fastify. It did not.
         */
        if (raw === '') return done(null, undefined);

        parseJson(request, raw, done);
      },
    );
  }
}
