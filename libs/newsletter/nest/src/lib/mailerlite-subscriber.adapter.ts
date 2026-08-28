import { Injectable, Logger } from '@nestjs/common';
import type { SubscriberPort, SubscribeRequest } from './subscriber.port';

const API_URL = 'https://connect.mailerlite.com/api/subscribers';

export class SubscriberDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriberDeliveryError';
  }
}

export interface MailerLiteConfig {
  apiKey: string;
  groupId: string;
  apiUrl?: string;
}

/**
 * Registers addresses with MailerLite as `unconfirmed`.
 *
 * That status is what makes the double opt-in email go out, and it is the
 * whole lawful basis here — creating `active` subscribers would be signing
 * people up rather than inviting them.
 *
 * **Double opt-in must also be enabled on the group in the MailerLite UI.**
 * Nothing in this code or in CI can verify that; if it is off, MailerLite may
 * activate `unconfirmed` subscribers without ever asking them.
 */
@Injectable()
export class MailerLiteSubscriberAdapter implements SubscriberPort {
  private readonly logger = new Logger(MailerLiteSubscriberAdapter.name);

  constructor(private readonly config: MailerLiteConfig) {}

  async subscribe(request: SubscribeRequest): Promise<void> {
    const response = await fetch(this.config.apiUrl ?? API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: request.email,
        status: 'unconfirmed',
        groups: [this.config.groupId],
        ...(request.source ? { fields: { source: request.source } } : {}),
      }),
    });

    if (response.ok) return;

    // 422 is MailerLite's "already subscribed" among other validation cases.
    // Re-subscribing an existing address is not an error the caller can act on,
    // and reporting it would leak whether an address is on the list.
    if (response.status === 422) {
      this.logger.log('MailerLite rejected a subscriber as already present');
      return;
    }

    const body = await response.text().catch(() => '');
    throw new SubscriberDeliveryError(
      `MailerLite responded ${response.status}: ${body.slice(0, 200)}`,
    );
  }
}
