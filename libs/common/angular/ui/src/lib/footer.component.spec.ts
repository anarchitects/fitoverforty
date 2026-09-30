import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FooterComponent } from './footer.component';
import { FIT_OVER_FORTY } from '@fitoverforty/site-ts';
import { provideSiteIdentity } from '@fitoverforty/site-angular';

/**
 * The footer carries routerLinks now, so it needs a router to instantiate at
 * all — without one it fails on ActivatedRoute rather than on anything these
 * tests are about.
 */
async function render() {
  await TestBed.configureTestingModule({
    imports: [FooterComponent],
    providers: [provideRouter([]), provideSiteIdentity(FIT_OVER_FORTY)],
  }).compileComponents();

  const fixture = TestBed.createComponent(FooterComponent);
  fixture.detectChanges();
  return fixture;
}

describe('FooterComponent', () => {
  it('renders the current year and brand text', async () => {
    const fixture = await render();

    const rendered = fixture.nativeElement.textContent;
    expect(rendered).toContain('Fit Over Forty');
    expect(rendered).toContain(String(new Date().getFullYear()));
  });

  it('is the only route to the privacy notice', async () => {
    // Nothing else on the site links to it. If this disappears, the page
    // becomes reachable only by typing the URL, which is how it was.
    const fixture = await render();
    const hrefs = [
      ...fixture.nativeElement.querySelectorAll('.anx-footer__links a'),
    ].map((a: HTMLAnchorElement) => a.getAttribute('href'));

    expect(hrefs).toContain('/privacy');
  });

  it('links the feed with a real href, not a route', async () => {
    // The feed is served by the backend, outside the Angular application:
    // routing to it would look for a page that does not exist.
    const fixture = await render();
    const feed: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a[href="/blog/feed.xml"]',
    );

    expect(feed).toBeTruthy();
    expect(feed.getAttribute('ng-reflect-router-link')).toBeNull();
  });
});
