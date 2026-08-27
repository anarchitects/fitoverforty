import { BadRequestException } from '@nestjs/common';

export interface SubscribeInput {
  email: string;
  source?: string;
}

// Deliberately permissive: the only authority on whether an address exists is
// the confirmation email, and over-strict patterns reject valid addresses.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_SOURCE_LENGTH = 2048;

/** The field a real person never sees and a bot fills in. */
export const HONEYPOT_FIELD = 'website';

export function parseSubscribeBody(body: unknown): SubscribeInput {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException('Expected an object');
  }
  const input = body as Record<string, unknown>;

  const honeypot = input[HONEYPOT_FIELD];
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    // Answering "accepted" rather than "rejected" gives a bot nothing to tune
    // against. The caller turns this into a silent success.
    throw new HoneypotTripped();
  }

  if (input['consent'] !== true) {
    throw new BadRequestException(
      'Consent is required, and must be given explicitly.',
    );
  }

  const email = typeof input['email'] === 'string' ? input['email'].trim() : '';
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) {
    throw new BadRequestException('A valid email address is required.');
  }

  const rawSource = input['source'];
  const source =
    typeof rawSource === 'string' && rawSource.length <= MAX_SOURCE_LENGTH
      ? rawSource
      : undefined;

  return { email: email.toLowerCase(), source };
}

/** Not an error the client should learn about. */
export class HoneypotTripped extends Error {
  constructor() {
    super('Honeypot field was filled');
    this.name = 'HoneypotTripped';
  }
}
