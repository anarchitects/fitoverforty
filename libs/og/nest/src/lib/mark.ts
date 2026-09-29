/**
 * The kettlebell, as a path in a 96×96 box.
 *
 * Copied from the brand's own SVG export, and identical to the path in
 * `frontend/public/favicon.svg`. It is duplicated rather than shared because
 * the only other copy lives in an Angular library, which a Nest process
 * cannot import — the shared home would be a platform-neutral `libs/brand/ts`,
 * which does not exist yet and is not worth inventing for one string.
 *
 * If the mark is ever redrawn, both copies have to move together.
 */
export const MARK_PATH =
  'M80.809,46.817c3.521-4.616,5.697-10.31,5.697-16.552c0-15.127-12.306-27.433-27.43-27.433H46.837 c-15.127,0-27.433,12.305-27.433,27.433c0,6.172,2.123,11.811,5.575,16.4c-3.719,5.424-5.912,11.976-5.912,19.051 c0,10.284,4.712,19.361,11.972,25.547c0.099,0.105,0.204,0.191,0.313,0.287c0.073,0.059,0.139,0.132,0.211,0.19h0.083 c0.851,0.646,1.873,1.092,3.037,1.092h36.299c1.167,0,2.189-0.445,3.04-1.092h0.072c0.073-0.056,0.132-0.121,0.198-0.178 c0.119-0.103,0.237-0.201,0.35-0.316c7.247-6.186,11.955-15.256,11.955-25.53C86.598,58.714,84.462,52.208,80.809,46.817z M78.072,59.135c-1.821,0.077-1.313-6.438-8.125-12.75c-7.181-6.654-15.833-4.32-15.8-6.773c0.04-2.986,6.415-1.518,10.381-0.122 c3.347,1.178,6.294,3.226,7.431,4.135c1.242,0.994,3.688,3.739,5.556,6.84C79.292,53.417,81.251,59,78.072,59.135z M71.009,37.338 c-5.256-3.373-11.471-5.384-18.177-5.384c-6.628,0-12.767,1.982-17.983,5.282c-1.2-2.061-1.938-4.421-1.938-6.97 c0-7.679,6.248-13.927,13.927-13.927h12.239c7.68,0,13.924,6.248,13.924,13.927C73,32.857,72.249,35.257,71.009,37.338z';

export const MARK_VIEWBOX = '4.8 -0.2 96 96';

/**
 * The mark as a data URI, because satori renders `<img>` but not inline SVG
 * elements. The fill is baked in: there is no `currentColor` to inherit from
 * inside an image.
 */
export function markDataUri(fill: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}">` +
    `<path fill="${fill}" d="${MARK_PATH}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
