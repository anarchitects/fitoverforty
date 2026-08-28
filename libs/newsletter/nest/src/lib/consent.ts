/**
 * The canonical consent wording, owned by the server.
 *
 * Stored with every record so the audit trail evidences itself: "what did this
 * person agree to" is answered by the row, not by digging through git history
 * for what the page said that week.
 *
 * It is deliberately not taken from the request. A record of consent supplied
 * by the client is not evidence of anything.
 *
 * The CTA renders matching wording from its own constant, and an e2e test
 * compares the two through GET /api/newsletter/consent so they cannot drift.
 */
export const CONSENT = {
  version: '2026-08-26',
  text:
    'Yes, email me new posts from Fit Over Forty. I can unsubscribe at any ' +
    'time, and I have read the privacy policy.',
} as const;
