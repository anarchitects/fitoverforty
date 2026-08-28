import {
  SUPPORTED_BLOCK_TYPES,
  SUPPORTED_LIST_STYLES,
} from '@fitoverforty/blog-ts';
import type { SupportedBlockType } from '@fitoverforty/blog-ts';
import type { ImageUploader } from './image-upload.port';

/**
 * The block types this editor is allowed to produce.
 *
 * Re-exported from the shared content contract rather than restated. The
 * backend validates every block on write against exactly this list and rejects
 * anything else outright, and the public renderer has a branch per type — so a
 * second copy here would be a copy that can drift, and the way it drifts is an
 * author writing a post that cannot be saved.
 *
 * This is the only import in this library that is not from Editor.js or
 * Angular, and it is the §4 contract itself, which travels with the editor if
 * this is ever extracted.
 *
 * `paragraph` is Editor.js's built-in default and is not registered as a tool.
 */
export { SUPPORTED_BLOCK_TYPES };
export type { SupportedBlockType };

/**
 * Editor.js's tool config is loosely typed by design — every tool ships its
 * own shape — so this stays deliberately open rather than pretending to a
 * precision the library does not offer.
 */
export type ToolConfig = Record<string, unknown>;

/**
 * A toolbox entry, as Editor.js's tools declare them.
 *
 * `data` carries the preset the entry creates — for the list tool, which style
 * of list. Typed loosely because each tool decides its own `data` shape.
 */
interface ToolboxEntry {
  title?: string;
  data?: Record<string, unknown>;
}

/**
 * Hides the list tool's checklist entry.
 *
 * `@editorjs/list` registers three toolbox entries — unordered, ordered and
 * checklist — and offers no configuration to drop one. Its checklist emits
 * `style: 'checklist'` with a `meta.checked` flag per item, which the
 * validator rejects and the renderer has no branch for.
 *
 * Left alone, that is the worst failure this codebase can produce: the author
 * gets a working checklist in the toolbar, writes a whole post around it, and
 * only finds out at save time. Filtering the toolbox is the smallest fix that
 * keeps the offer and the contract honest — overriding the static getter
 * rather than patching the tool, so an upgrade that adds a fourth style is
 * excluded by default rather than silently let through.
 */
function restrictListStyles(ListTool: unknown): unknown {
  const allowed = SUPPORTED_LIST_STYLES as readonly string[];

  /**
   * The base has to be typed as returning `object`, not `unknown`: TypeScript
   * refuses to extend a constructor whose return type has no statically known
   * members. `override` is likewise not usable on a static member when the
   * base class is a variable rather than a named class.
   */
  const Base = ListTool as new (...args: never[]) => object;

  return class RestrictedList extends Base {
    static get toolbox(): ToolboxEntry[] {
      const inherited = (ListTool as { toolbox?: ToolboxEntry[] }).toolbox;
      if (!Array.isArray(inherited)) return [];
      return inherited.filter((entry) => {
        const style = entry?.data?.['style'];
        return typeof style === 'string' && allowed.includes(style);
      });
    }
  };
}

export interface ToolRegistryOptions {
  uploader: ImageUploader;
}

/**
 * Builds the tool map in one place, per the shape community epic #70
 * describes.
 *
 * Every tool is passed in already-imported rather than imported here, because
 * these are browser-only packages: importing them at module scope would pull
 * them into the server bundle, where `window` does not exist. The wrapper
 * loads them dynamically and hands them over.
 */
export function buildTools(
  modules: {
    Header: unknown;
    List: unknown;
    Quote: unknown;
    ImageTool: unknown;
    CodeTool: unknown;
    Table: unknown;
    Delimiter: unknown;
  },
  { uploader }: ToolRegistryOptions,
): Record<string, ToolConfig> {
  return {
    header: {
      class: modules.Header,
      inlineToolbar: true,
      config: {
        /**
         * h2 and h3 only. The post title is the page's h1, so a second one in
         * the body would give every post two competing top-level headings —
         * and the write-side validator rejects any other level anyway.
         */
        levels: [2, 3],
        defaultLevel: 2,
      },
    },

    list: {
      class: restrictListStyles(modules.List),
      inlineToolbar: true,
      config: { defaultStyle: 'unordered' },
    },

    quote: {
      class: modules.Quote,
      inlineToolbar: true,
    },

    image: {
      class: modules.ImageTool,
      config: {
        /**
         * Uploads go through the injected port, not through the tool's own
         * `endpoints` option. `endpoints` would have the tool POST directly to
         * a URL this library would have to know, which is exactly the coupling
         * that would stop it being extractable.
         */
        uploader: {
          uploadByFile: (file: File) => uploader.uploadFile(file),
          uploadByUrl: (url: string) => uploader.uploadByUrl(url),
        },
      },
    },

    code: { class: modules.CodeTool },

    table: {
      class: modules.Table,
      inlineToolbar: true,
      config: { withHeadings: true },
    },

    delimiter: { class: modules.Delimiter },
  };
}

/**
 * Inline formatting is left to Editor.js's built-ins: bold, italic and link.
 *
 * That covers the `<a href>` the write-side allowlist already permits. The
 * separate `@editorjs/link` package is deliberately absent — it produces a
 * link *preview* block, which is a different thing: it needs a server endpoint
 * that fetches arbitrary remote URLs on request, and it emits a `linkTool`
 * block that neither the validator nor the renderer accepts.
 */
