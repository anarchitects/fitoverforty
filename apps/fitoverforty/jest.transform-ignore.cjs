/**
 * Shared by the backend and backend-e2e Jest configs.
 *
 * sanitize-html is CommonJS, but its htmlparser2 chain is ESM-only. Node 24
 * copes via require(esm); Jest does not, so that chain has to be transformed
 * rather than skipped the way node_modules normally is.
 *
 * Matching on package names rather than paths keeps this working whether Yarn
 * hoists them to the top level or nests them under sanitize-html.
 *
 * Any project whose module graph reaches the blog content code needs this.
 * It lives here, and not in each config, so the two cannot drift apart.
 */
module.exports = [
  'node_modules/(?!.*(?:sanitize-html|htmlparser2|domhandler|domelementtype|domutils|dom-serializer|entities))',
];
