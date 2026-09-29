import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import satori, { type Font } from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { card, CARD_HEIGHT, CARD_WIDTH, type CardInput } from './og-card';
import { OG_ASSET_DIR } from './og-assets.token';

/**
 * The faces the card uses, and the only ones loaded.
 *
 * Satori takes font *bytes* — it has no access to the browser's font stack, so
 * anything not passed here silently falls back to whatever else is loaded and
 * the card renders in the wrong face. The names match the CSS in
 * `frontend/src/styles.css`; the weights are exactly those `og-card.ts` asks
 * for, because every extra face is a file in the artefact for nothing.
 *
 * `.woff`, not `.woff2`: satori's font parser reads ttf, otf and woff only,
 * and @fontsource ships both so the choice costs nothing but has to be made
 * deliberately. A woff2 loads without error and produces a card with no text.
 */
const FACES = [
  { file: 'manrope-latin-400-normal.woff', name: 'Manrope', weight: 400 },
  { file: 'manrope-latin-500-normal.woff', name: 'Manrope', weight: 500 },
  { file: 'manrope-latin-700-normal.woff', name: 'Manrope', weight: 700 },
  { file: 'bitter-latin-600-normal.woff', name: 'Bitter', weight: 600 },
] as const;

/**
 * resvg's own filename, kept as-is: the `assets` glob in the backend's
 * webpack config copies the file and cannot rename it, so inventing a tidier
 * name here would only mean looking for a file that is not there.
 */
const WASM_FILE = 'index_bg.wasm';

/**
 * `initWasm` is global to the module and refuses a second call — it throws
 * "Already initialized", which would turn the second card request of a
 * process into a 500. The promise is module-level rather than per-instance
 * for the same reason: two `OgRenderer`s in one process (a test that builds a
 * second Nest app, for instance) must share one initialisation.
 */
let wasmReady: Promise<void> | undefined;

function ensureWasm(path: string): Promise<void> {
  wasmReady ??= readFile(path).then((bytes) => initWasm(bytes));
  return wasmReady;
}

/** Test seam: lets a suite start from a clean module state. */
export function resetWasmForTests(): void {
  wasmReady = undefined;
}

@Injectable()
export class OgRenderer {
  private fonts?: Promise<Font[]>;

  constructor(@Inject(OG_ASSET_DIR) private readonly assetDir: string) {}

  /** Renders one card to PNG bytes. */
  async render(input: CardInput): Promise<Buffer> {
    const [fonts] = await Promise.all([
      this.loadFonts(),
      ensureWasm(join(this.assetDir, WASM_FILE)),
    ]);

    const svg = await satori(card(input) as never, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts,
    });

    return Buffer.from(new Resvg(svg).render().asPng());
  }

  /**
   * Read once per process. The four faces are about 80 kB in total and never
   * change, so re-reading them per request would be pure filesystem churn on
   * the hot path of something a crawler may hit for every post at once.
   */
  private loadFonts(): Promise<Font[]> {
    this.fonts ??= Promise.all(
      FACES.map(async (face) => ({
        name: face.name,
        data: await readFile(join(this.assetDir, 'fonts', face.file)),
        weight: face.weight,
        style: 'normal' as const,
      })),
    );
    return this.fonts;
  }
}
