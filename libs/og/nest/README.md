# og-nest

Renders the image that appears when a page of this site is pasted into a chat,
a timeline or a search result — the `og:image`.

Two routes, both outside the `/api` prefix because their URLs end up inside
`<meta>` tags:

| Route                 | Card                                            |
| --------------------- | ----------------------------------------------- |
| `GET /og/blog/:slug.png` | The post's title, description and pillar     |
| `GET /og/site.png`       | The site's own name and standfirst           |

`SeoService` in `@fitoverforty/seo-angular` points at them: a post uses its hero
image when it has one and its card when it does not, and every other page falls
back to the site card.

## Why generate them

A link with no `og:image` is not rendered as a plain link. Most platforms show a
grey placeholder with the URL underneath, which reads as broken rather than
bare. Before this library, only a post with a hero image had one — the home
page, every pillar page and every post without a photograph had none.

## How a card is drawn

`satori` lays out an element tree and produces SVG; `@resvg/resvg-wasm`
rasterises that SVG to PNG. Neither needs a browser, which is the point: a
headless Chrome on the box to draw a social card would be the largest dependency
in the deployment by a wide margin.

`og-card.ts` holds the layout and nothing else — it is pure, takes no fonts and
touches no filesystem, so its tests are about composition rather than pixels.
`og-renderer.ts` owns the parts that talk to the outside world.

## Things that bite

**Satori needs font bytes, and only some formats.** It has no font stack to fall
back on, so a face not passed in `fonts` is silently substituted and the card
renders in the wrong typeface. It parses `ttf`, `otf` and `woff` — **not**
`woff2`. @fontsource ships both `.woff` and `.woff2` and no `.ttf` at all, so
the wrong choice is one character away and fails by rendering a card with no
text on it rather than by throwing.

**`initWasm` may be called once per process.** A second call throws
`Already initialized`, which would make the first card request succeed and every
one after it a 500. The guard is a module-level promise, not a field, so two
`OgRenderer` instances in one process still share one initialisation.

**The fonts and the WASM are copied, not resolved.** They are read from
`OG_ASSET_DIR`, which in the artefact is `join(__dirname, 'assets')` — filled by
the `assets` list in `apps/fitoverforty/backend/webpack.config.js`. Resolving
them out of `node_modules` with `require.resolve` looks tidier and does not
work: webpack rewrites `require.resolve` at build time into a module id, so the
path stops being a path. A suite that runs from source has no such directory and
overrides the token; `createFastifyTestApp({ ogAssetDir })` is that seam.

**Adding a face means editing two places.** `FACES` in `og-renderer.ts` says
what is loaded and `webpack.config.js` says what is shipped. They are checked
against each other by `og-renderer.spec.ts`, which builds the artefact's
directory layout rather than pointing at `node_modules`.

## Caching

`OgService` keeps the last 64 rendered cards, keyed by slug **and** the post's
`updatedAt` — so editing a post produces a new key rather than serving the old
card until the process restarts. The bound matters: slugs come from the URL, so
an unbounded map is a leak anyone can drive.

The HTTP header is `max-age=3600` and deliberately not `immutable`, because the
URL carries only the slug and an edited post has to be able to change what it
returns.
