import { createHmac } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { createFastifyTestApp } from '../support/create-fastify-test-app';

/**
 * The unsubscribe webhook, over real HTTP against a real database.
 *
 * The part that cannot be unit tested is the one most worth testing: the raw
 * body has to survive Fastify's JSON parsing for the signature to verify at
 * all. A unit test hands `verifySignature` a string and proves nothing about
 * whether the bytes ever reach it.
 */

const SECRET = 'e2e-webhook-secret';
const PREFIX = 'e2e-webhook-';
const URL = '/newsletter/webhook';

describe('newsletter unsubscribe webhook', () => {
  let app: NestFastifyApplication;
  let dataSource: DataSource;

  const post = (body: string, signature?: string) =>
    app.inject({
      method: 'POST',
      url: URL,
      payload: body,
      headers: {
        'content-type': 'application/json',
        ...(signature === undefined ? {} : { signature }),
      },
    });

  const sign = (body: string) =>
    createHmac('sha256', SECRET).update(body).digest('hex');

  const unsubscribe = (email: string, updatedAt = '2026-08-01T00:00:00Z') =>
    JSON.stringify({
      id: `sub-${email}`,
      email,
      event: 'subscriber.unsubscribed',
      updated_at: updatedAt,
    });

  const rowsFor = (email: string) =>
    dataSource.query(
      `SELECT "kind", "event_source", "consent_text", "dedupe_key"
         FROM "newsletter"."consents" WHERE "email" = $1`,
      [email],
    );

  beforeAll(async () => {
    // Read by createWebhookSecret at module construction, so it has to be set
    // before the app is built.
    process.env['MAILERLITE_WEBHOOK_SECRET'] = SECRET;
    app = await createFastifyTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    delete process.env['MAILERLITE_WEBHOOK_SECRET'];
    await dataSource.query(
      `DELETE FROM "newsletter"."consents" WHERE "email" LIKE $1`,
      [`${PREFIX}%`],
    );
    await app.close();
  });

  describe('signature', () => {
    it('records a withdrawal for a correctly signed delivery', async () => {
      const email = `${PREFIX}ok@example.test`;
      const body = unsubscribe(email);

      const response = await post(body, sign(body));

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        recorded: 1,
        duplicates: 0,
      });

      const rows = await rowsFor(email);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          kind: 'withdrawn',
          event_source: 'mailerlite:subscriber.unsubscribed',
          // No wording, because nobody was shown a form.
          consent_text: null,
        }),
      );
    });

    it('rejects an unsigned delivery and writes nothing', async () => {
      const email = `${PREFIX}unsigned@example.test`;
      const response = await post(unsubscribe(email));

      expect(response.statusCode).toBe(401);
      await expect(rowsFor(email)).resolves.toHaveLength(0);
    });

    it('rejects a forged signature', async () => {
      const email = `${PREFIX}forged@example.test`;
      const body = unsubscribe(email);
      const forged = createHmac('sha256', 'not-the-secret')
        .update(body)
        .digest('hex');

      expect((await post(body, forged)).statusCode).toBe(401);
      await expect(rowsFor(email)).resolves.toHaveLength(0);
    });

    it('rejects a body altered after signing', async () => {
      // The attack this endpoint exists to refuse: replaying a valid signature
      // over a substituted address would let anyone unsubscribe anyone.
      const victim = `${PREFIX}victim@example.test`;
      const original = unsubscribe(`${PREFIX}attacker@example.test`);
      const tampered = original.replace(
        `${PREFIX}attacker@example.test`,
        victim,
      );

      expect((await post(tampered, sign(original))).statusCode).toBe(401);
      await expect(rowsFor(victim)).resolves.toHaveLength(0);
    });

    /**
     * The regression this whole raw-body arrangement exists to prevent.
     *
     * Fastify parses JSON before the handler runs. If the raw bytes are not
     * kept, verification has to work from a re-serialisation — and
     * `JSON.stringify(JSON.parse(x))` is not `x`. This body is signed with
     * spacing that any normalisation would destroy.
     */
    it('verifies against the exact bytes, spacing included', async () => {
      const email = `${PREFIX}spaced@example.test`;
      const body = `{  "id" : "s1",  "email" : "${email}",\n  "event" : "subscriber.unsubscribed",  "updated_at" : "2026-08-02T00:00:00Z"  }`;

      expect((await post(body, sign(body))).statusCode).toBe(200);
      await expect(rowsFor(email)).resolves.toHaveLength(1);
    });
  });

  describe('idempotency', () => {
    it('records a retry once', async () => {
      // Providers retry. A retry must not read as a second withdrawal.
      const email = `${PREFIX}retry@example.test`;
      const body = unsubscribe(email);

      const first = await post(body, sign(body));
      const second = await post(body, sign(body));

      expect(JSON.parse(first.payload)).toEqual({
        recorded: 1,
        duplicates: 0,
      });
      expect(JSON.parse(second.payload)).toEqual({
        recorded: 0,
        duplicates: 1,
      });
      await expect(rowsFor(email)).resolves.toHaveLength(1);
    });

    it('records a genuine later withdrawal separately', async () => {
      // Unsubscribe, re-subscribe, unsubscribe again: two withdrawals, and
      // collapsing them would lose the history the table exists for.
      const email = `${PREFIX}again@example.test`;
      const first = unsubscribe(email, '2026-08-01T00:00:00Z');
      const later = unsubscribe(email, '2026-09-01T00:00:00Z');

      await post(first, sign(first));
      await post(later, sign(later));

      await expect(rowsFor(email)).resolves.toHaveLength(2);
    });

    it('survives concurrent retries', async () => {
      // Idempotency comes from the unique index, not a read-then-write: both
      // of these would pass a check-then-insert before either wrote.
      const email = `${PREFIX}concurrent@example.test`;
      const body = unsubscribe(email);

      const results = await Promise.all([
        post(body, sign(body)),
        post(body, sign(body)),
        post(body, sign(body)),
      ]);

      expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200]);
      await expect(rowsFor(email)).resolves.toHaveLength(1);
    });
  });

  describe('payload handling', () => {
    it('accepts a batched envelope', async () => {
      const one = `${PREFIX}batch1@example.test`;
      const two = `${PREFIX}batch2@example.test`;
      const body = JSON.stringify({
        total: 2,
        events: [
          { id: 'b1', email: one, event: 'subscriber.unsubscribed' },
          { id: 'b2', email: two, event: 'subscriber.deleted' },
        ],
      });

      const response = await post(body, sign(body));

      expect(JSON.parse(response.payload).recorded).toBe(2);
      await expect(rowsFor(one)).resolves.toHaveLength(1);
      await expect(rowsFor(two)).resolves.toHaveLength(1);
    });

    it('accepts and ignores an event it does not act on', async () => {
      // 200, not 4xx: MailerLite would otherwise retry a subscriber.created
      // delivery forever.
      const email = `${PREFIX}created@example.test`;
      const body = JSON.stringify({
        id: 'c1',
        email,
        event: 'subscriber.created',
      });

      const response = await post(body, sign(body));

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        recorded: 0,
        duplicates: 0,
      });
      await expect(rowsFor(email)).resolves.toHaveLength(0);
    });

    it('rejects a withdrawal carrying no address', async () => {
      const body = JSON.stringify({
        id: 'x',
        email: '',
        event: 'subscriber.unsubscribed',
      });
      expect((await post(body, sign(body))).statusCode).toBe(400);
    });
  });

  describe('the subscribe path still works alongside it', () => {
    it('leaves ordinary JSON routes parsing normally', async () => {
      // The raw-body parser replaces Fastify's JSON parser for every route,
      // so a plain POST elsewhere is the thing most likely to break silently.
      const response = await app.inject({
        method: 'POST',
        url: '/newsletter/subscribe',
        payload: { email: `${PREFIX}sub@example.test`, consent: true },
      });

      expect(response.statusCode).toBe(202);
      const rows = await rowsFor(`${PREFIX}sub@example.test`);
      expect(rows[0]).toEqual(
        expect.objectContaining({ kind: 'granted', dedupe_key: null }),
      );
    });

    it('still answers the consent endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/newsletter/consent',
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).version).toEqual(expect.any(String));
    });

    /**
     * Nest's adapter builds its JSON parser from Fastify's
     * `getDefaultJsonParser`, which wraps `secure-json-parse` and rejects these
     * payloads. Replacing that parser with a bare `JSON.parse` silently dropped
     * the protection from every JSON route in the app — it stayed dropped
     * through a full PR review, because nothing failed.
     *
     * These assert the replacement still delegates. They are deliberately on a
     * route that is *not* the webhook: the point is the blast radius of an
     * un-path-scoped parser, not the webhook's own behaviour.
     */
    it.each([
      ['__proto__', '"__proto__":{"polluted":true}'],
      ['constructor.prototype', '"constructor":{"prototype":{"polluted":true}}'],
    ])('rejects a payload poisoning %s', async (name, poison) => {
      // Every other field is valid on purpose. An incomplete body would be
      // rejected by `parseSubscribeBody` and the test would pass whether or not
      // the parser is hardened — which is exactly what it did on the first
      // attempt, and what the mutation check caught.
      const email = `${PREFIX}poison-${name.replace(/\W+/g, '')}@example.test`;
      const payload = `{"email":"${email}","consent":true,${poison}}`;

      const response = await app.inject({
        method: 'POST',
        url: '/newsletter/subscribe',
        headers: { 'content-type': 'application/json' },
        payload,
      });

      // Without the secure parser this is a 202 and the row is written.
      expect(response.statusCode).toBe(400);
      expect(await rowsFor(email)).toHaveLength(0);
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });
  });
});
