import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PILLAR_SLUGS } from '@fitoverforty/blog-ts';
import { AboutPage } from './about.page';
import { FIT_OVER_FORTY } from '@fitoverforty/site-ts';
import { provideSiteIdentity } from '@fitoverforty/site-angular';

/**
 * The copy on this page is the point of it, so these tests guard the claims
 * rather than the layout.
 *
 * Two of them are about not saying something untrue. A blog written by people
 * with no qualification has to say so, and a page that lists the pillars has
 * to list all four — a tidy-up that drops the disclaimer or one of the
 * headings changes what the site claims, and nothing else would catch it.
 */
describe('AboutPage', () => {
  let fixture: ComponentFixture<AboutPage>;

  const text = () =>
    (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ??
    '';
  const hrefs = () =>
    [
      ...(
        fixture.nativeElement as HTMLElement
      ).querySelectorAll<HTMLAnchorElement>('a[href]'),
    ].map((a) => a.getAttribute('href'));

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AboutPage],
      providers: [provideRouter([]), provideSiteIdentity(FIT_OVER_FORTY)],
    });
    fixture = TestBed.createComponent(AboutPage);
    await fixture.whenStable();
  });

  it('links every pillar, including one with no posts yet', () => {
    // Written out rather than fetched, so this is the only thing keeping the
    // page in step with the vocabulary. A pillar nobody has written for still
    // belongs here: it says what the blog is about, not what it contains.
    for (const slug of PILLAR_SLUGS) {
      expect(hrefs()).toContain(`/blog/pillar/${slug}`);
    }
  });

  it('disclaims medical advice', () => {
    expect(text()).toContain('not medical advice');
  });

  it('says the writers are not coaches', () => {
    expect(text()).toContain('neither of us is a coach');
  });

  it('points at the privacy notice rather than restating it', () => {
    // The page makes a claim about tracking; the notice is what has to be
    // accurate about it. Repeating the detail here would give us two places
    // to keep true.
    expect(hrefs()).toContain('/privacy');
  });

  it('offers the feed as a real href, not a route', () => {
    // Served by the backend, outside the Angular application — routing to it
    // would look for a page that does not exist.
    const feed = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLAnchorElement>('a[href="/blog/feed.xml"]');

    expect(feed).toBeTruthy();
    expect(feed?.getAttribute('ng-reflect-router-link')).toBeNull();
  });
});
