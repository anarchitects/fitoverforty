import { describe, expect, it } from 'vitest';
import { isBlocksBody, isHtmlBody } from './post';
import type { PostBody } from './post';

describe('post body discriminant', () => {
  const blocks: PostBody = {
    kind: 'blocks',
    blocks: {
      version: '2.31.6',
      blocks: [
        { type: 'paragraph', data: { text: 'Lifting after forty.' } },
        { type: 'header', data: { text: 'Recovery', level: 2 } },
      ],
    },
  };

  const html: PostBody = { kind: 'html', html: '<p>Imported.</p>' };

  it('identifies a blocks body', () => {
    expect(isBlocksBody(blocks)).toBe(true);
    expect(isHtmlBody(blocks)).toBe(false);
  });

  it('identifies an html body', () => {
    expect(isHtmlBody(html)).toBe(true);
    expect(isBlocksBody(html)).toBe(false);
  });

  it('narrows so the renderer can switch on kind without casting', () => {
    const body: PostBody = blocks;
    // The point of the union: this compiles only because the guard narrows.
    expect(isBlocksBody(body) ? body.blocks.blocks.length : -1).toBe(2);
  });

  it('accepts Editor.js output shape without a cast', () => {
    // Structural compatibility with @editorjs/editorjs OutputData is the
    // reason editorjs.ts re-declares rather than imports.
    const fromEditor = {
      version: '2.31.6',
      time: 1_700_000_000_000,
      blocks: [],
    };
    const body: PostBody = { kind: 'blocks', blocks: fromEditor };
    expect(isBlocksBody(body)).toBe(true);
  });
});
