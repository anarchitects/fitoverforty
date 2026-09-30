import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { SITE_ORIGIN } from '@fitoverforty/seo-angular';
import type { Paged, PillarSummary, PostSummary } from '@fitoverforty/blog-ts';
import type { Loaded } from '@fitoverforty/blog-angular-data-access';
import { PillarArchivePage } from './pillar-archive.page';
import { FIT_OVER_FORTY } from '@fitoverforty/site-ts';
import { provideSiteIdentity } from '@fitoverforty/site-angular';

const PILLARS: PillarSummary[] = [
  {
    slug: 'physical-fitness',
    name: 'Physical Fitness',
    postCount: 2,
    position: 1,
  },
  { slug: 'mental-fitness', name: 'Mental Fitness', postCount: 0, position: 2 },
];

const emptyPage: Paged<PostSummary> = {
  items: [],
  page: 1,
  perPage: 10,
  totalItems: 0,
  totalPages: 1,
};

/**
 * The pillar set is fixed at four, so a slug outside it is a wrong URL rather
 * than an empty section. Getting that wrong in either direction costs
 * something: answering 200 invites crawlers to index nonsense, and answering
 * 404 when the API merely blipped turns a transient failure into a permanent
 * signal.
 */
describe('PillarArchivePage', () => {
  const render = (
    pillar: string,
    pillars: Loaded<PillarSummary[]>,
    posts: Loaded<Paged<PostSummary>> = { ok: true, data: emptyPage },
  ) => {
    TestBed.configureTestingModule({
      imports: [PillarArchivePage],
      providers: [
        provideRouter([]),
        { provide: SITE_ORIGIN, useValue: 'https://example.test' },
        provideSiteIdentity(FIT_OVER_FORTY),
      ],
    });
    const fixture = TestBed.createComponent(PillarArchivePage);
    fixture.componentRef.setInput('pillar', pillar);
    fixture.componentRef.setInput('pillars', pillars);
    fixture.componentRef.setInput('posts', posts);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows the pillar name from the data, not the slug', () => {
    // The route only carries `physical-fitness`. Title-casing it here would
    // duplicate what the table holds and drift the moment a name is edited.
    const el = render('physical-fitness', { ok: true, data: PILLARS });
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(
      'Physical Fitness',
    );
  });

  it('renders a pillar that has no posts yet, rather than treating it as missing', () => {
    const el = render('mental-fitness', { ok: true, data: PILLARS });
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Mental Fitness');
    expect(el.querySelector('fitoverforty-not-found-page')).toBeNull();
  });

  it('answers not-found for a slug that is not one of the pillars', () => {
    const el = render('nonsense', { ok: true, data: PILLARS });
    expect(el.querySelector('fitoverforty-not-found-page')).not.toBeNull();
    expect(el.querySelector('.blog-pillar-archive')).toBeNull();
  });

  it('does not claim not-found when the pillar list failed to load', () => {
    // A failed request means we do not know whether the pillar exists. Saying
    // "not found" would turn an API blip into a 404 a crawler can act on.
    const el = render('physical-fitness', { ok: false });
    expect(el.querySelector('fitoverforty-not-found-page')).toBeNull();
  });
});
