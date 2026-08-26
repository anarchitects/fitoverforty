import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('renders the site title in the header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(
      compiled.querySelector('header .anx-heading')?.textContent,
    ).toContain('Fit Over Forty');
  });

  it('leaves h1 to the routed page', async () => {
    // The site title used to be an h1 in the header, which gave every page two
    // first-level headings once the pages grew their own.
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('h1'),
    ).toBeNull();
  });
});
