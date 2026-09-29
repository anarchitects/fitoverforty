/**
 * Where the fonts and the resvg WASM live on disk.
 *
 * A token rather than a constant because the answer differs by how the code is
 * running. In the built artefact they sit beside `main.js`, copied there by the
 * `assets` list in the backend's `webpack.config.js`. In a Jest suite there is
 * no artefact and no copy step, so a test points this at `node_modules`
 * instead. Resolving them with `require.resolve` would have avoided the token,
 * but webpack rewrites `require.resolve` at build time into a module id and
 * the path stops being a path.
 */
export const OG_ASSET_DIR = Symbol('OG_ASSET_DIR');
