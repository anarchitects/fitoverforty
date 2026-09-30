import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import type {
  AuthorProfile,
  ContentSource,
  Paged,
  PillarSummary,
  Post,
  PostRef,
  PostSummary,
  TagSummary,
} from '@fitoverforty/blog-ts';

const API = '/api/blog';

@Injectable()
export class HttpContentSource implements ContentSource {
  private readonly http = inject(HttpClient);

  listPosts(page: number, perPage: number): Promise<Paged<PostSummary>> {
    return firstValueFrom(
      this.http.get<Paged<PostSummary>>(`${API}/posts`, {
        params: { page, perPage },
      }),
    );
  }

  postsByTag(
    tagSlug: string,
    page: number,
    perPage: number,
  ): Promise<Paged<PostSummary>> {
    return firstValueFrom(
      this.http.get<Paged<PostSummary>>(
        `${API}/tags/${encodeURIComponent(tagSlug)}/posts`,
        { params: { page, perPage } },
      ),
    );
  }

  listPillars(): Promise<PillarSummary[]> {
    return firstValueFrom(this.http.get<PillarSummary[]>(`${API}/pillars`));
  }

  postsByPillar(
    pillarSlug: string,
    page: number,
    perPage: number,
  ): Promise<Paged<PostSummary>> {
    return firstValueFrom(
      this.http.get<Paged<PostSummary>>(
        `${API}/pillars/${encodeURIComponent(pillarSlug)}/posts`,
        { params: { page, perPage } },
      ),
    );
  }

  /**
   * Only the sitemap needs this, and the sitemap is generated server-side, so
   * the browser never calls it. It exists to satisfy the port.
   */
  listPublishedRefs(): Promise<PostRef[]> {
    return firstValueFrom(this.http.get<PostRef[]>(`${API}/posts/refs`));
  }

  /**
   * Rejects, rather than calling an endpoint, because there is no endpoint to
   * call and there should not be.
   *
   * The sitemap is the only caller and it is generated inside the backend,
   * against `TypeOrmContentSource`. Serving an authors collection over HTTP
   * purely so this method could be implemented would build the API an authors
   * index page needs — and that page is a decision against, not something
   * nobody got round to. `listPublishedRefs` above has an endpoint only
   * because `/posts/refs` was already there.
   */
  listAuthorRefs(): Promise<never> {
    return Promise.reject(
      new Error(
        'listAuthorRefs is server-side only: it feeds the sitemap, and the ' +
          'browser has no authors endpoint to ask.',
      ),
    );
  }

  listTags(): Promise<TagSummary[]> {
    return firstValueFrom(this.http.get<TagSummary[]>(`${API}/tags`));
  }

  /**
   * A missing author is `undefined` rather than an error, matching loadPost:
   * the caller renders "not found", it does not distinguish a typo from a
   * backend problem.
   */
  loadAuthor(slug: string): Promise<AuthorProfile | undefined> {
    return firstValueFrom(
      this.http
        .get<AuthorProfile>(`${API}/authors/${encodeURIComponent(slug)}`)
        .pipe(
          map((author) => author ?? undefined),
          catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 404) {
              return of(undefined);
            }
            throw error;
          }),
        ),
    );
  }

  postsByAuthor(
    authorSlug: string,
    page: number,
    perPage: number,
  ): Promise<Paged<PostSummary>> {
    return firstValueFrom(
      this.http.get<Paged<PostSummary>>(
        `${API}/authors/${encodeURIComponent(authorSlug)}/posts`,
        { params: { page, perPage } },
      ),
    );
  }

  relatedPosts(slug: string, limit: number): Promise<PostSummary[]> {
    return firstValueFrom(
      this.http.get<PostSummary[]>(
        `${API}/posts/${encodeURIComponent(slug)}/related`,
        { params: { limit } },
      ),
    );
  }

  /**
   * A missing post is `undefined`, not an error. Drafts, future-dated posts
   * and typos are all 404 from the API by design, and the caller's job is to
   * render "not found", not to distinguish them.
   */
  loadPost(slug: string): Promise<Post | undefined> {
    return firstValueFrom(
      this.http.get<Post>(`${API}/posts/${encodeURIComponent(slug)}`).pipe(
        map((post) => post ?? undefined),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            return of(undefined);
          }
          throw error;
        }),
      ),
    );
  }
}
