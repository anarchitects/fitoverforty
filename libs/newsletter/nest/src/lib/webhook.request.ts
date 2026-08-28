import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * MailerLite's webhook signature, and what it lets through.
 *
 * The v3 API sends a `Signature` header: the hex HMAC-SHA256 of the raw JSON
 * body, keyed with the secret MailerLite generated for that webhook. It is not
 * the account API key — that is the classic v2 scheme, which used a different
 * header and base64. This app talks to v3 (`connect.mailerlite.com`), so the
 * v3 rules apply.
 *
 * https://developers.mailerlite.com/docs/webhooks
 */
export const SIGNATURE_HEADER = 'signature';

/** The events that mean "stop emailing this person". */
export const WITHDRAWAL_EVENTS = [
  'subscriber.unsubscribed',
  'subscriber.deleted',
] as const;

export interface WithdrawalEvent {
  email: string;
  /** The provider event name, e.g. `subscriber.unsubscribed`. */
  event: string;
  /**
   * Stable across retries, distinct across genuine repeat events.
   * See the migration for why this composition and not an event id.
   */
  dedupeKey: string;
}

/**
 * Verifies the signature over the **raw** body.
 *
 * The raw bytes, never a re-serialisation of the parsed object: `JSON.parse`
 * followed by `JSON.stringify` does not round-trip byte-for-byte — key order,
 * whitespace and number formatting all move — so an HMAC over the reparsed
 * form would reject every genuine delivery.
 */
export function verifySignature(
  rawBody: string | undefined,
  provided: string | undefined,
  secret: string,
): void {
  if (rawBody === undefined) {
    // Means the raw-body capture is not wired for this route. Failing closed
    // is the only safe answer: the alternative is accepting unverified events.
    throw new BadRequestException('The request body could not be read.');
  }
  if (!provided) {
    throw new UnauthorizedException('Missing signature.');
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest();

  let actual: Buffer;
  try {
    actual = Buffer.from(provided, 'hex');
  } catch {
    throw new UnauthorizedException('Invalid signature.');
  }

  // Length is checked first because timingSafeEqual throws on a mismatch
  // rather than returning false, and an attacker controls this length.
  if (
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  ) {
    throw new UnauthorizedException('Invalid signature.');
  }
}

type Payload = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

/**
 * Pulls the withdrawal events out of a delivery.
 *
 * MailerLite sends either a single flat event or, when the webhook is
 * `batchable`, an `{ events: [...] }` envelope. Both are accepted because
 * which one arrives is a setting in their UI that nothing here controls, and
 * silently ignoring a batch would drop withdrawals without a trace.
 *
 * Events that are not withdrawals are ignored rather than rejected: a webhook
 * subscribed to more events than this cares about is a configuration choice,
 * not an error, and answering 4xx would make MailerLite retry them forever.
 */
export function parseWithdrawalEvents(body: unknown): WithdrawalEvent[] {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException('Expected a JSON object.');
  }

  const payload = body as Payload;
  const batch = payload['events'];
  const events: unknown[] = Array.isArray(batch) ? batch : [payload];

  const withdrawals: WithdrawalEvent[] = [];
  for (const raw of events) {
    if (!raw || typeof raw !== 'object') continue;
    const event = raw as Payload;

    // `event` on the flat shape, `type` on the nested one.
    const name = asString(event['event']) ?? asString(event['type']);
    if (!name || !(WITHDRAWAL_EVENTS as readonly string[]).includes(name)) {
      continue;
    }

    // Flat events carry the subscriber inline; nested ones wrap it.
    const subscriber =
      event['subscriber'] && typeof event['subscriber'] === 'object'
        ? (event['subscriber'] as Payload)
        : event;

    const email = asString(subscriber['email']);
    if (!email) {
      // A withdrawal we cannot attribute to an address is not something to
      // record against a guess, and not something a retry will fix.
      throw new BadRequestException(
        `A ${name} event arrived with no subscriber email.`,
      );
    }

    const id = asString(subscriber['id']) ?? email.toLowerCase();
    const changedAt =
      asString(subscriber['updated_at']) ?? asString(event['updated_at']) ?? '';

    withdrawals.push({
      email: email.toLowerCase(),
      event: name,
      dedupeKey: `${name}:${id}:${changedAt}`,
    });
  }

  return withdrawals;
}
