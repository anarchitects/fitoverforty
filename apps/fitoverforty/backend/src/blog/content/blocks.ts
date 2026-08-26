import type { OutputBlockData, OutputData } from '@fitoverforty/content-model';
import { InvalidBlockError } from './errors';
import { sanitiseInline } from './inline-html';

type Data = Record<string, unknown>;

interface Ctx {
  index: number;
  type: string;
}

function fail(ctx: Ctx, reason: string): never {
  throw new InvalidBlockError(ctx.index, ctx.type, reason);
}

function requireString(data: Data, key: string, ctx: Ctx): string {
  const value = data[key];
  if (typeof value !== 'string') {
    fail(ctx, `"${key}" must be a string`);
  }
  return value;
}

function optionalString(data: Data, key: string, ctx: Ctx): string | undefined {
  const value = data[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    fail(ctx, `"${key}" must be a string when present`);
  }
  return value;
}

function optionalBoolean(
  data: Data,
  key: string,
  ctx: Ctx,
): boolean | undefined {
  const value = data[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    fail(ctx, `"${key}" must be a boolean when present`);
  }
  return value;
}

/**
 * Rejects anything that is not an http(s) URL or a site-relative path.
 * `javascript:` and `data:` in an image src are the reason this exists.
 */
function requireSafeUrl(value: string, ctx: Ctx, key: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    fail(
      ctx,
      `"${key}" must be an absolute http(s) URL or a path starting with "/"`,
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    fail(ctx, `"${key}" must use http or https, got "${parsed.protocol}"`);
  }
  return parsed.toString();
}

type ListItem = string | { content: string; items: ListItem[] };

function sanitiseListItems(value: unknown, ctx: Ctx): ListItem[] {
  if (!Array.isArray(value)) fail(ctx, '"items" must be an array');
  return value.map((item): ListItem => {
    // Editor.js's older list tool emits plain strings; the nested tool emits
    // { content, items }. Both are accepted so a tool upgrade is not a
    // breaking change to stored content.
    if (typeof item === 'string') return sanitiseInline(item);
    if (item && typeof item === 'object') {
      const record = item as Data;
      return {
        content: sanitiseInline(requireString(record, 'content', ctx)),
        items:
          record['items'] === undefined
            ? []
            : sanitiseListItems(record['items'], ctx),
      };
    }
    return fail(
      ctx,
      'list items must be strings or { content, items } objects',
    );
  });
}

const HANDLERS: Record<string, (data: Data, ctx: Ctx) => Data> = {
  paragraph: (data, ctx) => ({
    text: sanitiseInline(requireString(data, 'text', ctx)),
  }),

  header: (data, ctx) => {
    const level = data['level'];
    // The post title is the page's h1, so body headings are h2/h3 only. This
    // also keeps the stored shape aligned with the Heading type in
    // @fitoverforty/content-model.
    if (level !== 2 && level !== 3) {
      fail(ctx, `"level" must be 2 or 3, got ${JSON.stringify(level)}`);
    }
    return { text: sanitiseInline(requireString(data, 'text', ctx)), level };
  },

  list: (data, ctx) => {
    const style = data['style'];
    if (style !== 'ordered' && style !== 'unordered') {
      fail(
        ctx,
        `"style" must be "ordered" or "unordered", got ${JSON.stringify(style)}`,
      );
    }
    return { style, items: sanitiseListItems(data['items'], ctx) };
  },

  quote: (data, ctx) => {
    const alignment = optionalString(data, 'alignment', ctx);
    if (
      alignment !== undefined &&
      alignment !== 'left' &&
      alignment !== 'center'
    ) {
      fail(ctx, `"alignment" must be "left" or "center" when present`);
    }
    const caption = optionalString(data, 'caption', ctx);
    return {
      text: sanitiseInline(requireString(data, 'text', ctx)),
      ...(caption === undefined ? {} : { caption: sanitiseInline(caption) }),
      ...(alignment === undefined ? {} : { alignment }),
    };
  },

  image: (data, ctx) => {
    const file = data['file'];
    if (!file || typeof file !== 'object')
      fail(ctx, '"file" must be an object');
    const url = requireSafeUrl(
      requireString(file as Data, 'url', ctx),
      ctx,
      'file.url',
    );
    const caption = optionalString(data, 'caption', ctx);
    const withBorder = optionalBoolean(data, 'withBorder', ctx);
    const withBackground = optionalBoolean(data, 'withBackground', ctx);
    const stretched = optionalBoolean(data, 'stretched', ctx);
    return {
      file: { url },
      ...(caption === undefined ? {} : { caption: sanitiseInline(caption) }),
      ...(withBorder === undefined ? {} : { withBorder }),
      ...(withBackground === undefined ? {} : { withBackground }),
      ...(stretched === undefined ? {} : { stretched }),
    };
  },

  // Deliberately not HTML-sanitised: code is plain text and the renderer emits
  // it as text. Running it through the inline allowlist would silently eat any
  // snippet containing angle brackets.
  code: (data, ctx) => ({ code: requireString(data, 'code', ctx) }),

  delimiter: () => ({}),

  table: (data, ctx) => {
    const content = data['content'];
    if (!Array.isArray(content))
      fail(ctx, '"content" must be an array of rows');
    const withHeadings = optionalBoolean(data, 'withHeadings', ctx);
    return {
      ...(withHeadings === undefined ? {} : { withHeadings }),
      content: content.map((row) => {
        if (!Array.isArray(row))
          fail(ctx, 'each row must be an array of cells');
        return row.map((cell) => {
          if (typeof cell !== 'string') fail(ctx, 'each cell must be a string');
          return sanitiseInline(cell);
        });
      }),
    };
  },
};

export const SUPPORTED_BLOCK_TYPES = Object.keys(HANDLERS);

/**
 * Validates and sanitises an Editor.js payload for storage.
 *
 * Unknown block types are rejected rather than stored and skipped at render:
 * storing a block nothing can display is how content silently disappears.
 */
export function sanitiseBody(input: unknown): OutputData {
  if (!input || typeof input !== 'object') {
    throw new InvalidBlockError(-1, 'body', 'must be an object');
  }
  const body = input as Data;
  const blocks = body['blocks'];
  if (!Array.isArray(blocks)) {
    throw new InvalidBlockError(-1, 'body', '"blocks" must be an array');
  }

  const sanitised: OutputBlockData[] = blocks.map((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      throw new InvalidBlockError(index, 'unknown', 'block must be an object');
    }
    const block = raw as Data;
    const type = block['type'];
    if (typeof type !== 'string') {
      throw new InvalidBlockError(index, 'unknown', '"type" must be a string');
    }
    const ctx: Ctx = { index, type };
    const handler = HANDLERS[type];
    if (!handler) {
      fail(
        ctx,
        `unsupported block type; expected one of ${SUPPORTED_BLOCK_TYPES.join(', ')}`,
      );
    }
    const data = block['data'];
    if (!data || typeof data !== 'object')
      fail(ctx, '"data" must be an object');
    const id = block['id'];
    return {
      ...(typeof id === 'string' ? { id } : {}),
      type,
      data: handler(data as Data, ctx),
      // `tunes` is dropped: nothing renders it, and storing unvalidated
      // arbitrary objects is exactly what this function exists to prevent.
    };
  });

  const version = body['version'];
  const time = body['time'];
  return {
    ...(typeof version === 'string' ? { version } : {}),
    ...(typeof time === 'number' ? { time } : {}),
    blocks: sanitised,
  };
}
