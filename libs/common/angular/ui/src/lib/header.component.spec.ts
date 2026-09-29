import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeaderComponent } from './header.component';

/**
 * The header carries a `routerLink`, so it needs a router to instantiate at
 * all — without one the whole component fails with NG0201 on `ActivatedRoute`
 * rather than anything about the link.
 */
async function render() {
  await TestBed.configureTestingModule({
    imports: [HeaderComponent],
    providers: [provideRouter([])],
  }).compileComponents();

  const fixture = TestBed.createComponent(HeaderComponent);
  fixture.detectChanges();
  return fixture;
}

describe('HeaderComponent', () => {
  it('renders the app title', async () => {
    const fixture = await render();

    // The name is no longer written out — the mark carries it, and this is
    // what stops it becoming a header that announces nothing.
    const svg: SVGSVGElement = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.querySelector('title')?.textContent?.trim()).toBe(
      'Fit Over Forty',
    );
  });

  it('points the mark at the home page', async () => {
    const fixture = await render();
    const link: HTMLAnchorElement =
      fixture.nativeElement.querySelector('.fitoverforty-brand a');

    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/');
  });

  it('wraps the mark rather than sitting beside it', async () => {
    // The link takes its accessible name from the mark's own title. An anchor
    // that did not contain the SVG would be an unlabelled link, which is
    // worse than no link at all.
    const fixture = await render();
    const link: HTMLAnchorElement =
      fixture.nativeElement.querySelector('.fitoverforty-brand a');

    expect(link.querySelector('svg')).toBeTruthy();
  });
});
