import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import type {
  ContentSource,
  Paged,
  Post,
  PostSummary,
  TagRef,
} from '@fitoverforty/content-model';

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

  listTags(): Promise<TagRef[]> {
    return firstValueFrom(this.http.get<TagRef[]>(`${API}/tags`));
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
