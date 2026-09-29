import { dirname, join } from 'node:path';
import { mkdtemp, mkdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { OgRenderer } from './og-renderer';

/**
 * Lays out a directory that looks like the built artefact's.
 *
 * The renderer reads its fonts and its WASM from one directory because that is
 * what `webpack.config.js` produces; building the same shape here is what makes
 * this test cover the real arrangement rather than a convenient one. If the
 * asset list in that config and the filenames in `og-renderer.ts` ever drift
 * apart, this is what fails.
 */
async function assetDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'og-assets-'));
  await mkdir(join(root, 'fonts'), { recursive: true });

  const fontsource = (pkg: string, file: string) =>
    join(dirname(require.resolve(`@fontsource/${pkg}/package.json`)), 'files', file);

  await Promise.all([
    ...(['400', '500', '700'] as const).map((w) =>
      copyFile(
        fontsource('manrope', `manrope-latin-${w}-normal.woff`),
        join(root, 'fonts', `manrope-latin-${w}-normal.woff`),
      ),
    ),
    copyFile(
      fontsource('bitter', 'bitter-latin-600-normal.woff'),
      join(root, 'fonts', 'bitter-latin-600-normal.woff'),
    ),
    copyFile(
      require.resolve('@resvg/resvg-wasm/index_bg.wasm'),
      join(root, 'index_bg.wasm'),
    ),
  ]);

  return root;
}

/** The first bytes of any PNG, and the IHDR width/height that follow. */
function readPng(bytes: Buffer): { signature: boolean; width: number; height: number } {
  return {
    signature: bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe('OgRenderer', () => {
  let renderer: OgRenderer;

  beforeAll(async () => {
    renderer = new OgRenderer(await assetDir());
  });

  it('renders a real PNG at the size every scraper crops to', async () => {
    const png = await renderer.render({
      title: 'What a month of Zone 2 running did to my resting heart rate',
      description: 'Eight weeks and one chest strap.',
      pillar: 'Physical fitness',
      kicker: 'fitoverforty.test',
    });

    expect(readPng(png)).toEqual({ signature: true, width: 1200, height: 630 });
  }, 30_000);

  /**
   * `initWasm` refuses a second call, so a second render in the same process
   * is the case that would break — and it is every request after the first.
   */
  it('renders again in the same process', async () => {
    const png = await renderer.render({ title: 'Sleep' });
    expect(readPng(png).signature).toBe(true);
  }, 30_000);

  /**
   * A card whose text failed to lay out still produces a valid PNG of the
   * right size — it is simply blank. Comparing against an empty render is
   * what distinguishes "drew the title" from "drew the background".
   */
  it('draws more than the background', async () => {
    const [blank, titled] = await Promise.all([
      renderer.render({ title: '' }),
      renderer.render({ title: 'Sleep' }),
    ]);
    expect(titled.length).toBeGreaterThan(blank.length);
  }, 30_000);
});
