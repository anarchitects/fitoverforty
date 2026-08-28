import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  AdminPost,
  AdminPostSummary,
  PostDraftInput,
} from '@fitoverforty/blog-ts';
import { firstValueFrom, type Observable } from 'rxjs';

/** Sent with every call: the session is a cookie, not a header. */
const CREDENTIALS = { withCredentials: true } as const;

/**
 * The authoring API, as the editor sees it.
 *
 * Separate from `HttpContentSource`, which implements the public read contract
 * and must only ever see published content. Merging them would put a method
 * that returns drafts on the same object the public pages inject.
 */
@Injectable({ providedIn: 'root' })
export class PostsApi {
  private readonly http = inject(HttpClient);

  list(): Promise<AdminPostSummary[]> {
    return this.send(
      this.http.get<AdminPostSummary[]>('/api/admin/posts', CREDENTIALS),
    );
  }

  load(id: string): Promise<AdminPost> {
    return this.send(
      this.http.get<AdminPost>(`/api/admin/posts/${id}`, CREDENTIALS),
    );
  }

  create(draft: PostDraftInput): Promise<AdminPost> {
    return this.send(
      this.http.post<AdminPost>('/api/admin/posts', draft, CREDENTIALS),
    );
  }

  update(id: string, draft: PostDraftInput): Promise<AdminPost> {
    return this.send(
      this.http.patch<AdminPost>(
        `/api/admin/posts/${id}`,
        draft,
        CREDENTIALS,
      ),
    );
  }

  /** Omit `publishedAt` for "now"; pass a future instant to schedule. */
  publish(id: string, publishedAt?: string): Promise<AdminPost> {
    return this.send(
      this.http.post<AdminPost>(
        `/api/admin/posts/${id}/publish`,
        publishedAt ? { publishedAt } : {},
        CREDENTIALS,
      ),
    );
  }

  unpublish(id: string): Promise<AdminPost> {
    return this.send(
      this.http.post<AdminPost>(
        `/api/admin/posts/${id}/unpublish`,
        {},
        CREDENTIALS,
      ),
    );
  }

  /**
   * Surfaces the server's message rather than replacing it.
   *
   * The write API's refusals are the useful kind — which block is invalid,
   * which slug is taken, that the hero needs alt text — and every one of them
   * names something the author can go and fix. "Something went wrong" would
   * throw all of that away.
   */
  private async send<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message = (error.error as { message?: unknown } | null)?.message;
        throw new Error(
          typeof message === 'string'
            ? message
            : Array.isArray(message)
              ? message.join(' ')
              : `The server refused that (${error.status}).`,
        );
      }
      throw error;
    }
  }
}
