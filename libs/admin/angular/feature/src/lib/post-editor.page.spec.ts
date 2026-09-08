import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import type { AdminPost, PillarSummary } from '@fitoverforty/blog-ts';
import { CONTENT_SOURCE } from '@fitoverforty/blog-angular-data-access';
import { PostEditorPage } from './post-editor.page';

/**
 * Mostly the class, not the template.
 *
 * What matters for the request tests is the order of the calls: that
 * publishing saves first, and that the server's answer is what the form ends
 * up holding. None of that is in the markup, so those tests construct the page
 * directly.
 *
 * This file used to say rendering was not possible, because it would mount the
 * Editor.js wrapper and its dynamically imported browser-only library. That is
 * not true — `createComponent` works fine here, the dynamic import simply does
 * not block the first render. The mode-toggle block below relies on that, and
 * the note is corrected rather than removed because it is the reason the
 * template went uncovered.
 */
const PILLARS: PillarSummary[] = [
  {
    slug: 'physical-fitness',
    name: 'Physical Fitness',
    postCount: 2,
    position: 1,
  },
  { slug: 'mental-fitness', name: 'Mental Fitness', postCount: 0, position: 2 },
];

/**
 * A stub rather than the real HttpContentSource.
 *
 * The editor asks for the pillar list on construction, and routing that
 * through the HTTP mock would put an unrelated pending request in front of
 * every assertion in this file — including `http.verify()`, which would then
 * fail on a call no test is about.
 */
function stubContentSource() {
  return { listPillars: () => Promise.resolve(PILLARS) };
}

function makePost(over: Partial<AdminPost> = {}): AdminPost {
  return {
    id: 'post-1',
    slug: 'a-post',
    title: 'A post',
    description: 'About something.',
    status: 'draft',
    publishedAt: null,
    scheduled: false,
    readingTimeMinutes: 1,
    pillar: null,
    tags: [],
    updatedAt: '2026-08-27T10:00:00.000Z',
    body: { blocks: [] },
    hero: null,
    ...over,
  };
}

describe('PostEditorPage', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;

  /**
   * Lets the promise chain behind a flushed request finish.
   *
   * `firstValueFrom` plus the `async` methods on the page put several
   * microtask turns between the flush and the signal being set, so a single
   * `await` sees the form still empty.
   */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  function build(id: string | null): PostEditorPage {
    navigate = vi.fn().mockResolvedValue(true);

    // Each test builds its own page, and TestBed refuses to be reconfigured
    // once something has been injected out of it.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
        { provide: CONTENT_SOURCE, useValue: stubContentSource() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(id ? { id } : {}),
            },
          },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    return TestBed.runInInjectionContext(() => new PostEditorPage());
  }

  afterEach(() => http.verify());

  it('loads an existing post and fills the form from it', async () => {
    const page = build('post-1');
    http.expectOne('/api/admin/posts/post-1').flush(
      makePost({
        title: 'Loaded',
        tags: [
          { slug: 'strength', name: 'Strength' },
          { slug: 'rest', name: 'Rest' },
        ],
      }),
    );
    await settle();

    expect(page.title()).toBe('Loaded');
    // Round-tripped as the comma-separated text the input holds.
    expect(page.tagText()).toBe('Strength, Rest');
  });

  it('creates rather than updates when there is no id yet', async () => {
    const page = build(null);
    page.title.set('New');
    page.description.set('New post.');

    const pending = page.saveDraft();
    http
      .expectOne({ method: 'POST', url: '/api/admin/posts' })
      .flush(makePost({ id: 'created-1', slug: 'new' }));
    await pending;

    // The URL has to carry the id from here on, or a reload would make a
    // second post out of the same draft.
    expect(navigate).toHaveBeenCalledWith(
      ['/admin/posts', 'created-1'],
      expect.objectContaining({ replaceUrl: true }),
    );
  });

  it('saves before publishing, so what goes live is what is on screen', async () => {
    const page = build('post-1');
    http.expectOne('/api/admin/posts/post-1').flush(makePost());
    await settle();

    page.title.set('Edited after loading');
    const pending = page.publishNow();

    const save = http.expectOne({
      method: 'PATCH',
      url: '/api/admin/posts/post-1',
    });
    expect((save.request.body as { title: string }).title).toBe(
      'Edited after loading',
    );
    save.flush(makePost({ title: 'Edited after loading' }));
    await settle();

    http
      .expectOne({ method: 'POST', url: '/api/admin/posts/post-1/publish' })
      .flush(makePost({ status: 'published', title: 'Edited after loading' }));

    await pending;
    expect(page.post()?.status).toBe('published');
  });

  it('sends a scheduled time as an absolute instant', async () => {
    const page = build('post-1');
    http.expectOne('/api/admin/posts/post-1').flush(makePost());
    await settle();

    page.scheduleAt.set('2026-09-01T09:00');
    const pending = page.schedule();

    http
      .expectOne({ method: 'PATCH', url: '/api/admin/posts/post-1' })
      .flush(makePost());
    await settle();

    const publish = http.expectOne({
      method: 'POST',
      url: '/api/admin/posts/post-1/publish',
    });

    // datetime-local carries no zone; the browser's own is the right reading,
    // and it must be resolved here rather than left for the server to guess.
    const { publishedAt } = publish.request.body as { publishedAt: string };
    expect(publishedAt).toBe(new Date('2026-09-01T09:00').toISOString());

    publish.flush(makePost({ status: 'published', scheduled: true }));
    await pending;
    expect(page.post()?.scheduled).toBe(true);
  });

  it("shows the server's refusal and stops being busy", async () => {
    const page = build('post-1');
    http.expectOne('/api/admin/posts/post-1').flush(makePost());
    await settle();

    const pending = page.publishNow();
    http.expectOne({ method: 'PATCH', url: '/api/admin/posts/post-1' }).flush(
      {
        message:
          'The hero image needs alt text before this post can be published.',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await pending;

    expect(page.status()).toEqual({
      kind: 'error',
      text: 'The hero image needs alt text before this post can be published.',
    });
    // A stuck busy flag disables every button and the only way out is a reload.
    expect(page.busy()).toBe(false);
  });

  it('does not publish when the save that precedes it fails', async () => {
    const page = build('post-1');
    http.expectOne('/api/admin/posts/post-1').flush(makePost());
    await settle();

    const pending = page.publishNow();
    http.expectOne({ method: 'PATCH', url: '/api/admin/posts/post-1' }).flush(
      { message: 'Another post already uses that slug.' },
      {
        status: 409,
        statusText: 'Conflict',
      },
    );
    await pending;

    // http.verify() in afterEach is what asserts no publish went out.
    expect(page.post()?.status).toBe('draft');
  });

  /**
   * The editor-mode toggle.
   *
   * It used to mark the current mode by disabling its button. That reads as a
   * reasonable way to show which one is active and is wrong twice: a disabled
   * button is out of the tab order, so a keyboard user can never reach the
   * mode they are in, and it is announced as *unavailable* rather than
   * *selected* — close to the opposite of what is true.
   *
   * These assert the attribute assistive technology actually reads, and that
   * both buttons stay reachable. The styling in `admin.css` keys off the same
   * attribute, so the visual and announced states cannot drift apart.
   */
  describe('the editor mode toggle', () => {
    function render() {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: CONTENT_SOURCE, useValue: stubContentSource() },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: convertToParamMap({}) } },
          },
        ],
      });
      const fixture = TestBed.createComponent(PostEditorPage);
      fixture.detectChanges();
      return fixture;
    }

    const buttons = (fixture: { nativeElement: HTMLElement }) =>
      Array.from(
        fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
          '.admin-mode button',
        ),
      );

    it('offers every pillar plus an explicit unfiled option', async () => {
      // "Not filed yet" has to be selectable rather than implied by a blank
      // first entry: clearing a pillar is a thing an author does deliberately,
      // and a draft is allowed to stay that way.
      const fixture = render();
      await Promise.resolve();
      fixture.detectChanges();

      const options = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLOptionElement>(
          'select[name="pillar"] option',
        ),
      );
      expect(options.map((o) => o.value)).toEqual([
        '',
        'physical-fitness',
        'mental-fitness',
      ]);
      expect(options[0].textContent?.trim()).toBe('Not filed yet');
    });

    it('names the pillars from the API rather than from their slugs', async () => {
      const fixture = render();
      await Promise.resolve();
      fixture.detectChanges();

      const labels = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLOptionElement>(
          'select[name="pillar"] option',
        ),
      ).map((o) => o.textContent?.trim());
      expect(labels).toContain('Physical Fitness');
    });

    it('reports the current mode with aria-pressed', () => {
      const fixture = render();
      const [write, preview] = buttons(fixture);

      expect(write.getAttribute('aria-pressed')).toBe('true');
      expect(preview.getAttribute('aria-pressed')).toBe('false');
    });

    it('moves the pressed state when the mode changes', () => {
      const fixture = render();
      const [write, preview] = buttons(fixture);

      preview.click();
      fixture.detectChanges();

      expect(write.getAttribute('aria-pressed')).toBe('false');
      expect(preview.getAttribute('aria-pressed')).toBe('true');
    });

    /**
     * The regression this exists for. A disabled button cannot be focused, so
     * disabling the selected one removes the current mode from the tab order
     * entirely.
     */
    it('keeps both buttons reachable, including the selected one', () => {
      const fixture = render();

      for (const button of buttons(fixture)) {
        expect(button.disabled).toBe(false);
      }
    });

    it('is a no-op when the already-selected mode is clicked', () => {
      const fixture = render();
      const [write, preview] = buttons(fixture);

      write.click();
      fixture.detectChanges();

      expect(write.getAttribute('aria-pressed')).toBe('true');
      expect(preview.getAttribute('aria-pressed')).toBe('false');
    });
  });
});
