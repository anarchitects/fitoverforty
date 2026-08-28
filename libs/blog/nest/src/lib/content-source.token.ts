/**
 * The controller depends on the ContentSource port, never on the TypeORM
 * implementation. Swapping the source — an API, an Editor.js service, a
 * fixture in a test — is then a provider change and nothing else.
 */
export const CONTENT_SOURCE = Symbol('CONTENT_SOURCE');
