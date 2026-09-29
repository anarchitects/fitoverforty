import { dirname, join } from 'node:path';
import { copyFile, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createFastifyTestApp } from '../support/create-fastify-test-app';

const SEEDED_SLUG = 'why-lifting-after-forty-is-different';

/**
 * Lays out the directory `webpack.config.js` produces in the artefact.
 *
 * Copied rather than pointed at `node_modules` directly, so the test depends
 * on the same *shape* the deployed process reads — one directory holding
 * `index_bg.wasm` and a `fonts/` beside it. A change to that layout that
 * forgot this file would pass against a loose set of resolved paths.
 */
async function artefactAssets(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'og-e2e-'));
  await mkdir(join(root, 'fonts'), { recursive: true });

  const font = (pkg: string, file: string) =>
    join(
      dirname(require.resolve(`@fontsource/${pkg}/package.json`)),
      'files',
      file,
    );

  await Promise.all([
    ...(['400', '500', '700'] as const).map((weight) =>
      copyFile(
        font('manrope', `manrope-latin-${weight}-normal.woff`),
        join(root, 'fonts', `manrope-latin-${weight}-normal.woff`),
      ),
    ),
    copyFile(
      font('bitter', 'bitter-latin-600-normal.woff'),
      join(root, 'fonts', 'bitter-latin-600-normal.woff'),
    ),
    copyFile(
      require.resolve('@resvg/resvg-wasm/index_bg.wasm'),
      join(root, 'index_bg.wasm'),
    ),
  ]);

  return root;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('og cards', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createFastifyTestApp({ ogAssetDir: await artefactAssets() });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  const get = (url: string) => app.inject({ method: 'GET', url });

  it('serves a post card as a PNG, outside the /api prefix', async () => {
    // The path is what goes in an og:image tag, so /api in it would be both
    // strange and permanent. That exclusion lives in main.ts and is exactly
    // the kind of thing nothing else would notice losing.
    const response = await get(`/og/blog/${SEEDED_SLUG}.png`);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.rawPayload.subarray(0, 8)).toEqual(PNG_MAGIC);
  }, 30_000);

  it('serves the site card', async () => {
    const response = await get('/og/site.png');

    expect(response.statusCode).toBe(200);
    expect(response.rawPayload.subarray(0, 8)).toEqual(PNG_MAGIC);
  }, 30_000);

  it('is not reachable under /api', async () => {
    expect((await get('/api/og/site.png')).statusCode).toBe(404);
  });

  it('answers 404 for a post that is not published', async () => {
    expect((await get('/og/blog/no-such-post.png')).statusCode).toBe(404);
  });

  it('answers 404 without the .png suffix', async () => {
    // The suffix is checked in the controller rather than in the route, so a
    // regression there would otherwise render a card for any path at all.
    expect((await get(`/og/blog/${SEEDED_SLUG}`)).statusCode).toBe(404);
  });

  it('sets nosniff and a cache lifetime', async () => {
    const { headers } = await get('/og/site.png');

    expect(headers['x-content-type-options']).toBe('nosniff');
    // Not `immutable`: the URL carries only the slug, so an edited post has
    // to be able to change what this returns.
    expect(headers['cache-control']).toBe('public, max-age=3600');
  }, 30_000);
});
