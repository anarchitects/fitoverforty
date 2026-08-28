import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import type { AdminPost } from '@fitoverforty/blog-ts';
import { PostEditorPage } from './post-editor.page';

/**
 * The class, not the template.
 *
 * Rendering it would mount the Editor.js wrapper, which dynamically imports a
 * browser-only library — and none of what is worth asserting here is in the
 * markup. What matters is the order of the requests: that publishing saves
 * first, and that the server's answer is what the form ends up holding.
 */
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
    http.expectOne({ method: 'POST', url: '/api/admin/posts' }).flush(
      makePost({ id: 'created-1', slug: 'new' }),
    );
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

    http.expectOne({ method: 'PATCH', url: '/api/admin/posts/post-1' }).flush(
      makePost(),
    );
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
      { message: 'The hero image needs alt text before this post can be published.' },
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
    http
      .expectOne({ method: 'PATCH', url: '/api/admin/posts/post-1' })
      .flush({ message: 'Another post already uses that slug.' }, {
        status: 409,
        statusText: 'Conflict',
      });
    await pending;

    // http.verify() in afterEach is what asserts no publish went out.
    expect(page.post()?.status).toBe('draft');
  });
});
