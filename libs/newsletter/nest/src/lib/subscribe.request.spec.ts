import { BadRequestException } from '@nestjs/common';
import {
  HONEYPOT_FIELD,
  HoneypotTripped,
  parseSubscribeBody,
} from './subscribe.request';

const valid = { email: 'reader@example.com', consent: true };

describe('parseSubscribeBody', () => {
  it('accepts a consented address and lowercases it', () => {
    expect(
      parseSubscribeBody({ ...valid, email: 'Reader@Example.COM' }),
    ).toEqual({ email: 'reader@example.com', source: undefined });
  });

  it('requires consent to be explicitly true', () => {
    // Affirmative consent: absent, false, and truthy-but-not-true are all no.
    for (const consent of [undefined, false, 'true', 1, null]) {
      expect(() => parseSubscribeBody({ ...valid, consent })).toThrow(
        BadRequestException,
      );
    }
  });

  it('rejects addresses that are obviously not addresses', () => {
    for (const email of [
      '',
      '   ',
      'nope',
      'a@b',
      'a b@c.com',
      'x'.repeat(300),
    ]) {
      expect(() => parseSubscribeBody({ ...valid, email })).toThrow(
        BadRequestException,
      );
    }
  });

  it('accepts addresses a stricter pattern would wrongly reject', () => {
    for (const email of [
      'first+tag@example.co.uk',
      "o'brien@example.com",
      'a_b-c@sub.domain.example',
    ]) {
      expect(() => parseSubscribeBody({ ...valid, email })).not.toThrow();
    }
  });

  it('signals a tripped honeypot distinctly, so the caller can fake success', () => {
    expect(() =>
      parseSubscribeBody({ ...valid, [HONEYPOT_FIELD]: 'http://spam' }),
    ).toThrow(HoneypotTripped);
  });

  it('ignores an empty honeypot, which is what a real person sends', () => {
    expect(() =>
      parseSubscribeBody({ ...valid, [HONEYPOT_FIELD]: '' }),
    ).not.toThrow();
  });

  it('drops an over-long source rather than rejecting the subscription', () => {
    const parsed = parseSubscribeBody({ ...valid, source: 'x'.repeat(3000) });
    expect(parsed.source).toBeUndefined();
  });

  it('rejects a body that is not an object', () => {
    for (const body of [null, undefined, 'nope', 42]) {
      expect(() => parseSubscribeBody(body)).toThrow(BadRequestException);
    }
  });
});
