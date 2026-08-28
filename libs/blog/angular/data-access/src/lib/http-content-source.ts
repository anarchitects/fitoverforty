import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import type {
  ContentSource,
  Paged,
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

  /**
   * Only the sitemap needs this, and the sitemap is generated server-side, so
   * the browser never calls it. It exists to satisfy the port.
   */
  listPublishedRefs(): Promise<PostRef[]> {
    return firstValueFrom(this.http.get<PostRef[]>(`${API}/posts/refs`));
  }

  listTags(): Promise<TagSummary[]> {
    return firstValueFrom(this.http.get<TagSummary[]>(`${API}/tags`));
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
