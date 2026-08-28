import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { parseWithdrawalEvents, verifySignature } from './webhook.request';

const SECRET = 'ybmcD7PQ9R';
const sign = (body: string) =>
  createHmac('sha256', SECRET).update(body).digest('hex');

describe('verifySignature', () => {
  const body = '{"event":"subscriber.unsubscribed","email":"a@b.test"}';

  it('accepts a correct signature', () => {
    expect(() => verifySignature(body, sign(body), SECRET)).not.toThrow();
  });

  it('rejects a signature made with a different secret', () => {
    const forged = createHmac('sha256', 'wrong').update(body).digest('hex');
    expect(() => verifySignature(body, forged, SECRET)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the body has been altered', () => {
    // The whole point: a signature valid for one payload must not authorise
    // marking a different address as withdrawn.
    const signature = sign(body);
    const tampered = body.replace('a@b.test', 'victim@example.test');
    expect(() => verifySignature(tampered, signature, SECRET)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a missing signature', () => {
    expect(() => verifySignature(body, undefined, SECRET)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a signature of the wrong length without throwing from compare', () => {
    // timingSafeEqual throws on length mismatch rather than returning false,
    // and the caller controls this length, so it must be checked first.
    expect(() => verifySignature(body, 'ab12', SECRET)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a signature that is not hex at all', () => {
    expect(() => verifySignature(body, 'zzzz'.repeat(16), SECRET)).toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed when the raw body was not captured', () => {
    // Means the raw-body parser is not wired. Accepting here would be
    // accepting unverified events.
    expect(() => verifySignature(undefined, sign(body), SECRET)).toThrow(
      BadRequestException,
    );
  });

  it('is computed over the exact bytes, not a re-serialisation', () => {
    // JSON.stringify(JSON.parse(x)) !== x in general. If the implementation
    // ever normalised the body, this spacing would break it.
    const spaced = '{ "event" : "subscriber.unsubscribed" }';
    expect(() => verifySignature(spaced, sign(spaced), SECRET)).not.toThrow();
  });
});

describe('parseWithdrawalEvents', () => {
  const flat = {
    id: '100000000000000000',
    email: 'John.Doe@Example.test',
    event: 'subscriber.unsubscribed',
    updated_at: '2026-05-28T10:30:29.000000Z',
  };

  it('reads a flat unsubscribe event', () => {
    expect(parseWithdrawalEvents(flat)).toEqual([
      {
        email: 'john.doe@example.test',
        event: 'subscriber.unsubscribed',
        dedupeKey:
          'subscriber.unsubscribed:100000000000000000:2026-05-28T10:30:29.000000Z',
      },
    ]);
  });

  it('treats a deletion as a withdrawal too', () => {
    const events = parseWithdrawalEvents({
      ...flat,
      event: 'subscriber.deleted',
    });
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('subscriber.deleted');
  });

  it('reads a batched envelope', () => {
    // Batching is a setting in MailerLite's UI that nothing here controls;
    // dropping a batch would lose withdrawals silently.
    const events = parseWithdrawalEvents({
      total: 2,
      events: [flat, { ...flat, id: '2', email: 'second@example.test' }],
    });
    expect(events.map((e) => e.email)).toEqual([
      'john.doe@example.test',
      'second@example.test',
    ]);
  });

  it('reads the nested subscriber shape', () => {
    const events = parseWithdrawalEvents({
      type: 'subscriber.unsubscribed',
      subscriber: { id: '7', email: 'nested@example.test', updated_at: 'x' },
    });
    expect(events[0]).toEqual({
      email: 'nested@example.test',
      event: 'subscriber.unsubscribed',
      dedupeKey: 'subscriber.unsubscribed:7:x',
    });
  });

  it('ignores events that are not withdrawals', () => {
    // A webhook subscribed to more events than this cares about is a config
    // choice. Answering 4xx would make MailerLite retry them forever.
    expect(parseWithdrawalEvents({ ...flat, event: 'subscriber.created' }))
      .toEqual([]);
  });

  it('keeps only the withdrawals out of a mixed batch', () => {
    const events = parseWithdrawalEvents({
      events: [{ ...flat, event: 'subscriber.created' }, flat],
    });
    expect(events).toHaveLength(1);
  });

  it('refuses a withdrawal with no address', () => {
    // Not something a retry fixes, and not something to record against a guess.
    expect(() => parseWithdrawalEvents({ ...flat, email: '' })).toThrow(
      BadRequestException,
    );
  });

  it('gives the same key for a retry and a different one for a later event', () => {
    const [first] = parseWithdrawalEvents(flat);
    const [retry] = parseWithdrawalEvents({ ...flat });
    const [later] = parseWithdrawalEvents({
      ...flat,
      updated_at: '2026-06-01T00:00:00.000000Z',
    });

    expect(retry.dedupeKey).toBe(first.dedupeKey);
    // A genuine unsubscribe after a re-subscribe must not be deduped away.
    expect(later.dedupeKey).not.toBe(first.dedupeKey);
  });
});
