import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SiteNavComponent } from './site-nav.component';

/**
 * The nav carries routerLinks, so it needs a router to instantiate at all.
 *
 * These tests are about the two things that would break silently: a link that
 * points nowhere useful, and a disclosure button whose `aria-expanded` stops
 * matching what is on screen — which is the whole of its accessible state.
 */
describe('SiteNavComponent', () => {
  let fixture: ComponentFixture<SiteNavComponent>;

  const el = () => fixture.nativeElement as HTMLElement;
  const toggle = (): HTMLButtonElement =>
    el().querySelector('.site-nav__toggle') as HTMLButtonElement;
  const list = (): HTMLUListElement =>
    el().querySelector('#site-nav-list') as HTMLUListElement;
  const hrefs = () =>
    [...list().querySelectorAll<HTMLAnchorElement>('a[href]')].map((a) =>
      a.getAttribute('href'),
    );

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SiteNavComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(SiteNavComponent);
    await fixture.whenStable();
  });

  it('links every section, in reading order', () => {
    expect(hrefs()).toEqual([
      '/blog',
      '/blog/pillars',
      '/blog/tags',
      '/about',
      '/contact',
    ]);
  });

  it('controls the list it names', () => {
    // A mismatch here breaks the button for a screen reader while leaving it
    // working for everyone else, which is the hardest kind to notice.
    expect(toggle().getAttribute('aria-controls')).toBe('site-nav-list');
    expect(list().id).toBe('site-nav-list');
  });

  it('starts closed and reports it', async () => {
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(list().classList).not.toContain('is-open');
  });

  it('opens and closes on the toggle, keeping aria-expanded in step', async () => {
    toggle().click();
    await fixture.whenStable();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(list().classList).toContain('is-open');

    toggle().click();
    await fixture.whenStable();

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(list().classList).not.toContain('is-open');
  });

  it('closes on Escape', async () => {
    toggle().click();
    await fixture.whenStable();

    el().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await fixture.whenStable();

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });
});
