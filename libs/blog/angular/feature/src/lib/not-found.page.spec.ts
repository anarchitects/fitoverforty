import { DOCUMENT, RESPONSE_INIT } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { SITE_ORIGIN } from '@fitoverforty/seo-angular';
import { NotFoundPage } from './not-found.page';

/**
 * The 404 page carries two obligations beyond its copy: it must answer with a
 * real 404 status when server-rendered, and it must not be indexable. Both are
 * invisible to a reader and very visible to a crawler.
 */
describe('NotFoundPage', () => {
  const render = (responseInit?: ResponseInit) => {
    TestBed.configureTestingModule({
      imports: [NotFoundPage],
      providers: [
        provideRouter([]),
        { provide: SITE_ORIGIN, useValue: 'https://example.test' },
        ...(responseInit
          ? [{ provide: RESPONSE_INIT, useValue: responseInit }]
          : []),
      ],
    });
    const fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();
    return fixture;
  };

  it('sets a real 404 when server-rendered', () => {
    // Otherwise the page is served as 200 with "Not found" in the body —
    // which readers cannot tell apart, but crawlers and monitoring can.
    const responseInit: ResponseInit = { status: 200 };
    render(responseInit);
    expect(responseInit.status).toBe(404);
  });

  it('renders in the browser, where there is no response to set', () => {
    expect(() => render()).not.toThrow();
  });

  it('marks itself noindex', () => {
    render();
    const robots = TestBed.inject(DOCUMENT).head.querySelector<HTMLMetaElement>(
      'meta[name="robots"]',
    );
    expect(robots?.content).toBe('noindex, follow');
  });

  it('offers a way back rather than a dead end', () => {
    const fixture = render();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('/blog');
  });
});
