import { InvalidBlockError, sanitiseBody } from './index';

const para = (text: string) => ({
  blocks: [{ type: 'paragraph', data: { text } }],
});
const textOf = (body: ReturnType<typeof sanitiseBody>) =>
  (body.blocks[0].data as { text: string }).text;

describe('sanitiseBody — hostile input', () => {
  it('strips script tags', () => {
    expect(
      textOf(sanitiseBody(para('Hi<script>alert(1)</script> there'))),
    ).toBe('Hi there');
  });

  it('strips img with an onerror handler', () => {
    expect(textOf(sanitiseBody(para('<img src=x onerror=alert(1)>')))).toBe('');
  });

  it('strips event handler attributes from allowed tags', () => {
    const out = textOf(sanitiseBody(para('<b onclick="steal()">bold</b>')));
    expect(out).toBe('<b>bold</b>');
    expect(out).not.toContain('onclick');
  });

  it('drops a javascript: href but keeps the link text', () => {
    const out = textOf(
      sanitiseBody(para('<a href="javascript:alert(1)">x</a>')),
    );
    expect(out).not.toContain('javascript:');
    expect(out).toContain('x');
  });

  it('rejects an image with a javascript: url', () => {
    expect(() =>
      sanitiseBody({
        blocks: [
          { type: 'image', data: { file: { url: 'javascript:alert(1)' } } },
        ],
      }),
    ).toThrow(InvalidBlockError);
  });

  it('rejects an image with a data: url', () => {
    expect(() =>
      sanitiseBody({
        blocks: [
          {
            type: 'image',
            data: { file: { url: 'data:text/html;base64,PHNjcmlwdD4=' } },
          },
        ],
      }),
    ).toThrow(/must use http or https/);
  });

  it('rejects protocol-relative image urls', () => {
    expect(() =>
      sanitiseBody({
        blocks: [
          { type: 'image', data: { file: { url: '//evil.example/x.png' } } },
        ],
      }),
    ).toThrow(InvalidBlockError);
  });

  it('rejects an unknown block type rather than storing it', () => {
    expect(() =>
      sanitiseBody({
        blocks: [{ type: 'rawHtml', data: { html: '<script>' } }],
      }),
    ).toThrow(/unsupported block type/);
  });

  it('drops tunes, which nothing validates and nothing renders', () => {
    const out = sanitiseBody({
      blocks: [
        { type: 'paragraph', data: { text: 'hi' }, tunes: { evil: { a: 1 } } },
      ],
    });
    expect(out.blocks[0]).not.toHaveProperty('tunes');
  });

  it('reports which block failed', () => {
    try {
      sanitiseBody({
        blocks: [
          { type: 'paragraph', data: { text: 'fine' } },
          { type: 'header', data: { text: 'bad', level: 9 } },
        ],
      });
      throw new Error('expected a throw');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidBlockError);
      expect((error as InvalidBlockError).index).toBe(1);
      expect((error as Error).message).toContain('header');
    }
  });
});

describe('sanitiseBody — permitted formatting survives', () => {
  it('keeps the inline tags the editor toolbar produces', () => {
    const input = '<b>b</b> <i>i</i> <mark>m</mark> <code>c</code><br />';
    expect(textOf(sanitiseBody(para(input)))).toContain('<b>b</b>');
    expect(textOf(sanitiseBody(para(input)))).toContain('<mark>m</mark>');
  });

  it('keeps http and relative hrefs', () => {
    expect(
      textOf(sanitiseBody(para('<a href="https://example.com">x</a>'))),
    ).toContain('href="https://example.com"');
    expect(textOf(sanitiseBody(para('<a href="/blog/other">x</a>')))).toContain(
      'href="/blog/other"',
    );
  });
});

describe('sanitiseBody — structure', () => {
  it('accepts heading levels 2 and 3 only', () => {
    for (const level of [2, 3]) {
      expect(() =>
        sanitiseBody({
          blocks: [{ type: 'header', data: { text: 'h', level } }],
        }),
      ).not.toThrow();
    }
    for (const level of [1, 4, '2', null]) {
      expect(() =>
        sanitiseBody({
          blocks: [{ type: 'header', data: { text: 'h', level } }],
        }),
      ).toThrow(/level/);
    }
  });

  it('sanitises nested list items at every depth', () => {
    const out = sanitiseBody({
      blocks: [
        {
          type: 'list',
          data: {
            style: 'unordered',
            items: [
              {
                content: 'top<script>x</script>',
                items: ['deep<script>y</script>'],
              },
            ],
          },
        },
      ],
    });
    expect(JSON.stringify(out)).not.toContain('script');
  });

  it('sanitises every table cell', () => {
    const out = sanitiseBody({
      blocks: [
        {
          type: 'table',
          data: { content: [['a<script>x</script>', '<b>b</b>']] },
        },
      ],
    });
    expect(JSON.stringify(out)).not.toContain('script');
    expect(JSON.stringify(out)).toContain('<b>b</b>');
  });

  it('leaves code blocks byte-for-byte alone', () => {
    // Code is plain text and the renderer must emit it via text interpolation,
    // never innerHTML. Running it through the inline allowlist would silently
    // eat any snippet containing angle brackets.
    const code = 'if (a < b) { return "<script>"; }';
    const out = sanitiseBody({ blocks: [{ type: 'code', data: { code } }] });
    expect((out.blocks[0].data as { code: string }).code).toBe(code);
  });

  it('rejects a body that is not an object or has no blocks array', () => {
    expect(() => sanitiseBody(null)).toThrow(InvalidBlockError);
    expect(() => sanitiseBody({ blocks: 'nope' })).toThrow(InvalidBlockError);
  });
});
