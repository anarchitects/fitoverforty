import { TestBed } from '@angular/core/testing';
import type { OutputData } from '@fitoverforty/blog-ts';
import { BlockRendererComponent } from './block-renderer.component';

async function render(blocks: OutputData, showUnknown = false) {
  await TestBed.configureTestingModule({
    imports: [BlockRendererComponent],
  }).compileComponents();

  const fixture = TestBed.createComponent(BlockRendererComponent);
  fixture.componentRef.setInput('blocks', blocks);
  fixture.componentRef.setInput('showUnknown', showUnknown);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const body = (...blocks: OutputData['blocks']): OutputData => ({ blocks });

describe('BlockRendererComponent', () => {
  it('renders paragraphs, keeping permitted inline markup', async () => {
    const el = await render(
      body({ type: 'paragraph', data: { text: 'A <b>bold</b> claim' } }),
    );
    expect(el.querySelector('p.blog-paragraph')?.innerHTML).toContain(
      '<b>bold</b>',
    );
  });

  it('renders h2 and h3 at the right level', async () => {
    const el = await render(
      body(
        { type: 'header', data: { text: 'Two', level: 2 } },
        { type: 'header', data: { text: 'Three', level: 3 } },
      ),
    );
    expect(el.querySelector('h2')?.textContent).toBe('Two');
    expect(el.querySelector('h3')?.textContent).toBe('Three');
  });

  it('stamps heading ids matching the shared derivation', async () => {
    const el = await render(
      body(
        { type: 'header', data: { text: 'Recovery &amp; Sleep', level: 2 } },
        { type: 'header', data: { text: 'Recovery &amp; Sleep', level: 2 } },
      ),
    );
    expect([...el.querySelectorAll('h2')].map((h) => h.id)).toEqual([
      'recovery-sleep',
      'recovery-sleep-2',
    ]);
  });

  it('renders nested lists at depth', async () => {
    const el = await render(
      body({
        type: 'list',
        data: {
          style: 'unordered',
          items: [{ content: 'top', items: [{ content: 'deep', items: [] }] }],
        },
      }),
    );
    expect(el.querySelector('ul li ul li')?.textContent).toContain('deep');
  });

  it('renders ordered lists as ol', async () => {
    const el = await render(
      body({ type: 'list', data: { style: 'ordered', items: ['one'] } }),
    );
    expect(el.querySelector('ol')).not.toBeNull();
    expect(el.querySelector('ul')).toBeNull();
  });

  it('renders code as text, never as markup', async () => {
    // The backend stores code unsanitised on purpose. Text interpolation here
    // is what makes that safe; [innerHTML] would be a stored-XSS hole.
    const el = await render(
      body({ type: 'code', data: { code: 'if (a < b) return "<script>";' } }),
    );
    const code = el.querySelector('pre.blog-code code');
    expect(code?.textContent).toBe('if (a < b) return "<script>";');
    expect(code?.querySelector('script')).toBeNull();
    expect(el.innerHTML).not.toContain('<script>');
  });

  it('renders images with lazy loading and caption as alt', async () => {
    const el = await render(
      body({
        type: 'image',
        data: { file: { url: '/assets/x.png' }, caption: 'A lifter' },
      }),
    );
    const img = el.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/assets/x.png');
    expect(img?.getAttribute('alt')).toBe('A lifter');
    expect(img?.getAttribute('loading')).toBe('lazy');
  });

  it('renders a table with headings split from the body', async () => {
    const el = await render(
      body({
        type: 'table',
        data: {
          withHeadings: true,
          content: [
            ['H1', 'H2'],
            ['a', 'b'],
          ],
        },
      }),
    );
    expect(
      [...el.querySelectorAll('thead th')].map((c) => c.textContent),
    ).toEqual(['H1', 'H2']);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('renders every row when there are no headings', async () => {
    const el = await render(
      body({ type: 'table', data: { content: [['a'], ['b']] } }),
    );
    expect(el.querySelectorAll('thead')).toHaveLength(0);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('says nothing about an unknown block in production', async () => {
    const el = await render(body({ type: 'futureThing', data: {} }), false);
    expect(el.textContent?.trim()).toBe('');
  });

  it('shows unknown blocks when asked, so they are caught in development', async () => {
    const el = await render(body({ type: 'futureThing', data: {} }), true);
    expect(el.textContent).toContain('futureThing');
  });

  it('strips markup Angular does not trust', async () => {
    // Defence in depth: content is allowlisted on write, but the renderer must
    // not become the place where that guarantee is quietly dropped.
    const el = await render(
      body({
        type: 'paragraph',
        data: { text: 'safe<img src=x onerror="alert(1)">' },
      }),
    );
    expect(el.innerHTML).not.toContain('onerror');
  });
});
