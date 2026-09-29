import { card, titleSize } from './og-card';
import { markDataUri, MARK_PATH } from './mark';

/** Walks the element tree and collects every string leaf. */
function texts(node: unknown): string[] {
  if (typeof node === 'string') return node ? [node] : [];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (node && typeof node === 'object' && 'props' in node) {
    return texts((node as { props: { children?: unknown } }).props.children);
  }
  return [];
}

describe('og card', () => {
  const input = {
    title: 'A post about something',
    description: 'And what came of it.',
    pillar: 'Physical fitness',
    kicker: 'fitoverforty.test',
  };

  it('puts the title, description and kicker on the card', () => {
    const found = texts(card(input));
    expect(found).toContain(input.title);
    expect(found).toContain(input.description);
    expect(found).toContain(input.kicker);
  });

  it('upper-cases the pillar', () => {
    // The footer is set in caps by hand rather than by text-transform, which
    // satori does not implement — lower-case here means it silently renders
    // out of keeping with every other card.
    expect(texts(card(input))).toContain('PHYSICAL FITNESS');
  });

  it('omits the description block when there is none', () => {
    const without = texts(card({ ...input, description: undefined }));
    expect(without).not.toContain(input.description);
    expect(without).toContain(input.title);
  });

  describe('title size', () => {
    it('sets a short title larger than a long one', () => {
      expect(titleSize('Sleep')).toBeGreaterThan(titleSize('x'.repeat(80)));
    });

    it('never returns a size that puts three lines past the card', () => {
      // Three clamped lines at 1.18 line-height have to fit the ~330px the
      // layout leaves between the masthead and the footer.
      for (const length of [1, 28, 29, 55, 56, 200]) {
        expect(titleSize('x'.repeat(length)) * 1.18 * 3).toBeLessThan(330);
      }
    });
  });
});

describe('mark', () => {
  it('encodes the fill into the data URI', () => {
    const decoded = Buffer.from(
      markDataUri('#123456').replace('data:image/svg+xml;base64,', ''),
      'base64',
    ).toString('utf8');
    expect(decoded).toContain('fill="#123456"');
    expect(decoded).toContain(MARK_PATH);
  });
});
