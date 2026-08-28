/**
 * The signing secret MailerLite generated for this webhook.
 *
 * A token rather than a direct `process.env` read so a test can supply one
 * without mutating the environment, and so "not configured" is a value the
 * controller can act on rather than something it has to discover.
 */
export const WEBHOOK_SECRET = Symbol('NEWSLETTER_WEBHOOK_SECRET');
