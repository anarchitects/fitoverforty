import { describe, expect, it } from 'vitest';
import {
  deriveHeadings,
  headingIdsByBlockIndex,
  plainText,
  slugify,
} from './headings';
import type { OutputData } from './editorjs';

const body = (...blocks: OutputData['blocks']): OutputData => ({ blocks });

describe('plainText', () => {
  it('strips the inline tags the sanitiser permits', () => {
    expect(plainText('A <b>bold</b> <a href="/x">claim</a>')).toBe(
      'A bold claim',
    );
  });

  it('decodes the entities the editor emits', () => {
    expect(plainText('Recovery &amp; Sleep')).toBe('Recovery & Sleep');
    expect(plainText('a &lt;b&gt; c')).toBe('a <b> c');
  });
});

describe('slugify', () => {
  it('kebab-cases and drops punctuation', () => {
    expect(slugify('Why It Matters!')).toBe('why-it-matters');
  });

  it('folds accents rather than dropping the word', () => {
    expect(slugify('Café Culture')).toBe('cafe-culture');
  });
});

describe('headingIdsByBlockIndex', () => {
  it('keys ids by block index, skipping non-headers', () => {
    const ids = headingIdsByBlockIndex(
      body(
        { type: 'paragraph', data: { text: 'intro' } },
        { type: 'header', data: { text: 'First', level: 2 } },
        { type: 'paragraph', data: { text: 'x' } },
        { type: 'header', data: { text: 'Second', level: 3 } },
      ).blocks,
    );
    expect([...ids.entries()]).toEqual([
      [1, 'first'],
      [3, 'second'],
    ]);
  });

  it('ignores header levels outside 2 and 3', () => {
    const ids = headingIdsByBlockIndex(
      body({ type: 'header', data: { text: 'Title', level: 1 } }).blocks,
    );
    expect(ids.size).toBe(0);
  });

  it('suffixes duplicates', () => {
    const ids = headingIdsByBlockIndex(
      body(
        { type: 'header', data: { text: 'Notes', level: 2 } },
        { type: 'header', data: { text: 'Notes', level: 2 } },
      ).blocks,
    );
    expect([...ids.values()]).toEqual(['notes', 'notes-2']);
  });
});

describe('deriveHeadings and headingIdsByBlockIndex agree', () => {
  // This is the property the whole module exists to guarantee: the ids the API
  // returns are the ids the renderer stamps onto elements.
  it('produces the same ids in the same order', () => {
    const content = body(
      { type: 'header', data: { text: 'Recovery &amp; Sleep', level: 2 } },
      { type: 'paragraph', data: { text: 'x' } },
      { type: 'header', data: { text: 'Recovery &amp; Sleep', level: 3 } },
    );
    const fromApi = deriveHeadings(content).map((h) => h.id);
    const fromRenderer = [...headingIdsByBlockIndex(content.blocks).values()];
    expect(fromApi).toEqual(fromRenderer);
    expect(fromApi).toEqual(['recovery-sleep', 'recovery-sleep-2']);
  });
});
