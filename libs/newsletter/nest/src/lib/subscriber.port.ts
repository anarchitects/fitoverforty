/**
 * The seam between "someone consented" and "an ESP knows about it".
 *
 * Mirrors the shape of forms-nest delivery deliberately (spec §12): if that
 * package ever grows a subscriber delivery target, this collapses into it
 * rather than being rewritten.
 */
export interface SubscribeRequest {
  email: string;
  /** The page they subscribed from, for the ESP's own attribution. */
  source?: string;
}

export interface SubscriberPort {
  /**
   * Registers an address with the ESP as *unconfirmed*, so the provider sends
   * the double opt-in email. Implementations must not create confirmed
   * subscribers: that would be subscribing someone on their behalf.
   */
  subscribe(request: SubscribeRequest): Promise<void>;
}

export const SUBSCRIBER_PORT = Symbol('SUBSCRIBER_PORT');
