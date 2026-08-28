import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PostsApi } from './posts.api';

const draft = {
  title: 'A post',
  slug: 'a-post',
  description: 'About something.',
  body: { blocks: [] },
};

describe('PostsApi', () => {
  let api: PostsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(PostsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends credentials, since the session lives in a cookie', () => {
    void api.list();
    expect(http.expectOne('/api/admin/posts').request.withCredentials).toBe(
      true,
    );
  });

  it('omits publishedAt when publishing now', () => {
    void api.publish('abc');
    const request = http.expectOne('/api/admin/posts/abc/publish');
    // An absent date is what the server reads as "now"; sending an empty
    // string or a null would be a parse error instead.
    expect(request.request.body).toEqual({});
  });

  it('sends publishedAt when scheduling', () => {
    void api.publish('abc', '2026-09-01T09:00:00.000Z');
    expect(
      http.expectOne('/api/admin/posts/abc/publish').request.body,
    ).toEqual({ publishedAt: '2026-09-01T09:00:00.000Z' });
  });

  it("surfaces the server's own refusal", async () => {
    // The write API's messages name the thing to fix — which block, which
    // slug, that the hero needs alt text. Replacing them with "failed" is
    // what makes an editor infuriating.
    const pending = api.create(draft);
    http.expectOne('/api/admin/posts').flush(
      { message: 'block 2 (image): "file" must be an object' },
      { status: 400, statusText: 'Bad Request' },
    );

    await expect(pending).rejects.toThrow(
      'block 2 (image): "file" must be an object',
    );
  });

  it('joins a message that arrives as a list', async () => {
    const pending = api.create(draft);
    http
      .expectOne('/api/admin/posts')
      .flush({ message: ['one', 'two'] }, { status: 400, statusText: 'Bad' });

    await expect(pending).rejects.toThrow('one two');
  });

  it('falls back to the status when the body carries no message', async () => {
    const pending = api.load('abc');
    http
      .expectOne('/api/admin/posts/abc')
      .flush(null, { status: 502, statusText: 'Bad Gateway' });

    await expect(pending).rejects.toThrow('(502)');
  });
});
