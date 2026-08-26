import sanitizeHtml from 'sanitize-html';

/**
 * The inline tags Editor.js's toolbar actually produces, and nothing else.
 *
 * This is the real control in the content-security story (spec §6). Block
 * payloads are cleaned here on the way *in*, so the database never holds
 * hostile markup; Angular's own sanitizer on the way out is the second layer,
 * not the first.
 */
const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 'a', 'code', 'mark', 'br'];

export function sanitiseInline(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href'] },
    // Relative hrefs stay allowed for internal links; javascript: does not.
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
  });
}

/** Plain text with all markup removed. Used for reading time and headings. */
export function toPlainText(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
