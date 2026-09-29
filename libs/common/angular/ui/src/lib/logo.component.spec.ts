import { TestBed } from '@angular/core/testing';
import { LogoComponent } from './logo.component';

/** Renders the component and hands back its one `<svg>`. */
async function render(
  inputs: Partial<{
    variant: 'lockup' | 'mark';
    decorative: boolean;
    label: string;
    wordmark: string;
    counter: boolean;
  }> = {},
): Promise<SVGSVGElement> {
  // Reset first: several tests render twice to compare two configurations, and
  // configureTestingModule throws once the module has been instantiated.
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [LogoComponent],
  }).compileComponents();
  const fixture = TestBed.createComponent(LogoComponent);
  fixture.componentRef.setInput('variant', inputs.variant ?? 'lockup');
  if (inputs.decorative !== undefined)
    fixture.componentRef.setInput('decorative', inputs.decorative);
  if (inputs.label !== undefined)
    fixture.componentRef.setInput('label', inputs.label);
  if (inputs.wordmark !== undefined)
    fixture.componentRef.setInput('wordmark', inputs.wordmark);
  if (inputs.counter !== undefined)
    fixture.componentRef.setInput('counter', inputs.counter);
  fixture.detectChanges();
  return fixture.nativeElement.querySelector('svg');
}

describe('LogoComponent', () => {
  it('draws in currentColor, so it inherits the theme rather than carrying one', async () => {
    const svg = await render();
    const painted = [...svg.querySelectorAll('path')].filter(
      (p) => !p.closest('mask'),
    );

    expect(painted).toHaveLength(1);
    expect(painted[0].getAttribute('fill')).toBe('currentColor');
    // A literal anywhere outside the mask would pin the mark to one theme. The
    // mask's own black and white are structural, not colour.
    expect(svg.outerHTML).not.toMatch(/fill="#/);
  });

  it('knocks the counter out of the bell rather than painting it on top', async () => {
    const svg = await render();
    const mask = svg.querySelector('mask');

    expect(mask?.querySelector('text')?.textContent?.trim()).toBe('40+');
    expect(mask?.querySelector('text')?.getAttribute('fill')).toBe('black');
    // Only inside the mask. On top of the bell it would need to know the
    // surface colour, and would be wrong on any other surface.
    const outside = [...svg.querySelectorAll('text')].filter(
      (t) => !t.closest('mask'),
    );
    expect(outside.map((t) => t.textContent?.trim())).not.toContain('40+');
  });

  it('drops the counter when asked, for sizes where it is only texture', async () => {
    const svg = await render({ counter: false });
    expect(svg.querySelector('mask text')).toBeNull();
  });

  it('sets the wordmark as live text, which is the whole point of rebuilding it', async () => {
    // The Looka export has the lettering as outlined paths, so it could never
    // follow the site's face. If this ever becomes a path again, that is lost.
    const svg = await render();
    const wordmark = [...svg.querySelectorAll('text')].find(
      (t) => !t.closest('mask'),
    );

    expect(wordmark?.textContent?.trim()).toBe('FITOVERFORTY');
    expect(getComputedStyle(wordmark as Element).fontFamily).toContain(
      'Manrope',
    );
  });

  it('widens the viewBox for the wordmark, which is wider than the bell', async () => {
    // The bell is 67.5 units wide and the wordmark about 139. Sizing the box to
    // the bell clips the lettering, which is what it did first time round.
    const lockup = await render({ variant: 'lockup' });
    const mark = await render({ variant: 'mark' });

    const width = (svg: SVGSVGElement) =>
      Number(svg.getAttribute('viewBox')?.split(/\s+/)[2]);

    expect(width(lockup)).toBeGreaterThan(139);
    expect(width(mark)).toBeLessThan(width(lockup));
    expect(mark.querySelector('text:not(mask text)')).toBeNull();
  });

  it('takes its aspect ratio from the viewBox, so one dimension is enough', async () => {
    // `inline-size: 100%` on the svg resolves against the host, so a host with
    // only a height set would otherwise have no width to resolve against.
    await render({ variant: 'lockup' });
    const lockupHost = TestBed.createComponent(LogoComponent).nativeElement;

    const svg = await render({ variant: 'mark' });
    const [, , w, h] = (svg.getAttribute('viewBox') as string)
      .split(/\s+/)
      .map(Number);
    expect(svg.parentElement?.style.aspectRatio).toBe(`${w} / ${h}`);
    expect(lockupHost).toBeTruthy();
  });

  it('is announced by default and silent when decorative', async () => {
    const named = await render({ label: 'Fit Over Forty' });
    expect(named.getAttribute('role')).toBe('img');
    expect(named.querySelector('title')?.textContent?.trim()).toBe(
      'Fit Over Forty',
    );
    expect(named.getAttribute('aria-labelledby')).toBe(
      named.querySelector('title')?.id,
    );

    // Beside a heading that already says the name, announcing it again is noise.
    const quiet = await render({ decorative: true });
    expect(quiet.getAttribute('aria-hidden')).toBe('true');
    expect(quiet.getAttribute('role')).toBeNull();
    expect(quiet.querySelector('title')).toBeNull();
  });

  it('gives every instance its own mask, so two on a page do not collide', async () => {
    const first = await render();
    const second = await render();

    const maskId = (svg: SVGSVGElement) =>
      svg.querySelector('mask')?.getAttribute('id');

    expect(maskId(first)).not.toBe(maskId(second));
    expect(
      first.querySelector('path:not(mask path)')?.getAttribute('mask'),
    ).toBe(`url(#${maskId(first)})`);
  });
});
