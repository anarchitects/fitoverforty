import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { createFastifyTestApp } from '../support/create-fastify-test-app';

/**
 * No MAILERLITE_* is set in the test environment, so the module resolves the
 * logging adapter: consent is still recorded and the whole path runs, but
 * nothing is sent anywhere.
 */
describe('newsletter', () => {
  let app: NestFastifyApplication;
  let dataSource: DataSource;

  const post = async (
    payload: Record<string, unknown>,
    headers: Record<string, string> = {},
  ) => {
    const response = await app.inject({
      method: 'POST',
      url: '/newsletter/subscribe',
      payload,
      headers,
    });
    return {
      status: response.statusCode,
      body: response.payload ? JSON.parse(response.payload) : undefined,
    };
  };

  const consentsFor = (email: string) =>
    dataSource.query<
      {
        email: string;
        consent_text: string;
        consent_version: string;
        ip_address: string | null;
        source_url: string | null;
      }[]
    >(
      `SELECT email, consent_text, consent_version, ip_address, source_url
         FROM "newsletter"."consents" WHERE email = $1`,
      [email],
    );

  beforeAll(async () => {
    app = await createFastifyTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await dataSource.query(
      `DELETE FROM "newsletter"."consents" WHERE email LIKE '%@e2e.test'`,
    );
    await app.close();
  });

  it('accepts a consented subscription and records what was agreed to', async () => {
    const email = `record-${Date.now()}@e2e.test`;
    const { status, body } = await post(
      { email, consent: true, source: '/blog' },
      { referer: 'https://example.test/blog' },
    );

    expect(status).toBe(202);
    expect(body).toEqual({ status: 'pending' });

    const rows = await consentsFor(email);
    expect(rows).toHaveLength(1);
    // The wording is stored, not just a version number, so the record
    // evidences itself.
    expect(rows[0].consent_text.length).toBeGreaterThan(20);
    expect(rows[0].consent_version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rows[0].source_url).toBe('https://example.test/blog');
  });

  it('rejects a subscription without explicit consent, and records nothing', async () => {
    const email = `noconsent-${Date.now()}@e2e.test`;
    expect((await post({ email, consent: false })).status).toBe(400);
    expect((await post({ email })).status).toBe(400);
    expect(await consentsFor(email)).toHaveLength(0);
  });

  it('rejects an invalid address', async () => {
    expect(
      (await post({ email: 'not-an-address', consent: true })).status,
    ).toBe(400);
  });

  it('answers a tripped honeypot exactly like a success, and records nothing', async () => {
    const email = `honeypot-${Date.now()}@e2e.test`;
    const { status, body } = await post({
      email,
      consent: true,
      website: 'http://spam.example',
    });

    // Indistinguishable from the happy path on purpose: a bot that can tell
    // the difference can tune around the honeypot.
    expect(status).toBe(202);
    expect(body).toEqual({ status: 'pending' });
    expect(await consentsFor(email)).toHaveLength(0);
  });

  it('keeps every act of consent, rather than replacing the last one', async () => {
    const email = `repeat-${Date.now()}@e2e.test`;
    await post({ email, consent: true });
    await post({ email, consent: true });
    // Re-subscribing is a new act of consent; the history is the evidence.
    expect(await consentsFor(email)).toHaveLength(2);
  });

  it('exposes the canonical consent wording for auditing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/newsletter/consent',
    });
    const body = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(body.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.text).toContain('unsubscribe');
  });
});
