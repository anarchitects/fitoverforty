import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { FIT_OVER_FORTY } from '@fitoverforty/site-ts';
import { provideSiteIdentity } from '@fitoverforty/site-angular';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // The header's mark links to the home page, so the component tree needs
      // a router to instantiate — without one it fails on ActivatedRoute
      // rather than on anything to do with what these tests assert.
      providers: [provideRouter([]), provideSiteIdentity(FIT_OVER_FORTY)],
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
