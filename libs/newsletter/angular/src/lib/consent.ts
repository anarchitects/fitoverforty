/**
 * The consent wording shown next to the checkbox.
 *
 * Must match CONSENT in the backend's newsletter module, which is what gets
 * stored with the record. They are separate constants so that every page does
 * not make a request to render a checkbox; an e2e test compares this against
 * GET /api/newsletter/consent so the two cannot drift apart unnoticed.
 */
export const CONSENT_TEXT =
  'Yes, email me new posts from Fit Over Forty. I can unsubscribe at any ' +
  'time, and I have read the privacy policy.';
