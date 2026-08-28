import type { OutputData } from '@fitoverforty/blog-ts';
import { extractHeadings, readingTimeMinutes } from './index';

const body = (...blocks: OutputData['blocks']): OutputData => ({ blocks });

describe('readingTimeMinutes', () => {
  it('never returns zero', () => {
    expect(readingTimeMinutes(body())).toBe(1);
    expect(
      readingTimeMinutes(body({ type: 'paragraph', data: { text: 'one' } })),
    ).toBe(1);
  });

  it('rounds up at 200 words per minute', () => {
    const words = Array.from({ length: 450 }, () => 'word').join(' ');
    expect(
      readingTimeMinutes(body({ type: 'paragraph', data: { text: words } })),
    ).toBe(3);
  });

  it('counts words, not markup', () => {
    const plain = body({ type: 'paragraph', data: { text: 'one two three' } });
    const marked = body({
      type: 'paragraph',
      data: { text: '<b>one</b> <i>two</i> <a href="/x">three</a>' },
    });
    expect(readingTimeMinutes(marked)).toBe(readingTimeMinutes(plain));
  });
});

describe('extractHeadings', () => {
  it('collects h2 and h3 with slugified ids', () => {
    const headings = extractHeadings(
      body(
        { type: 'header', data: { text: 'Why It Matters', level: 2 } },
        { type: 'paragraph', data: { text: 'x' } },
        { type: 'header', data: { text: 'Recovery & Sleep', level: 3 } },
      ),
    );
    expect(headings).toEqual([
      { depth: 2, id: 'why-it-matters', text: 'Why It Matters' },
      { depth: 3, id: 'recovery-sleep', text: 'Recovery & Sleep' },
    ]);
  });

  it('suffixes duplicate headings so ids stay unique', () => {
    const headings = extractHeadings(
      body(
        { type: 'header', data: { text: 'Notes', level: 2 } },
        { type: 'header', data: { text: 'Notes', level: 2 } },
        { type: 'header', data: { text: 'Notes', level: 2 } },
      ),
    );
    expect(headings.map((h) => h.id)).toEqual(['notes', 'notes-2', 'notes-3']);
  });

  it('strips markup from heading text', () => {
    const [heading] = extractHeadings(
      body({ type: 'header', data: { text: 'A <b>bold</b> claim', level: 2 } }),
    );
    expect(heading.text).toBe('A bold claim');
    expect(heading.id).toBe('a-bold-claim');
  });
});
