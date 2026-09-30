import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AdminPostSummary } from '@fitoverforty/blog-ts';
import { SeoService } from '@fitoverforty/seo-angular';
import { SITE_IDENTITY } from '@fitoverforty/site-angular';
import { AuthService } from '@fitoverforty/admin-angular-data-access';
import { PostsApi } from '@fitoverforty/admin-angular-data-access';

/**
 * Every post, drafts included.
 *
 * The public archive cannot serve this: it filters to published content, which
 * is exactly the set an author is not looking for when they come here to
 * finish something.
 */
@Component({
  selector: 'fitoverforty-admin-dashboard',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    <section class="anx-section">
      <div class="admin-dashboard-head">
        <h1>Posts</h1>
        <a routerLink="/admin/posts/new" class="admin-new">New post</a>
      </div>

      @if (auth.user(); as user) {
        <p>Signed in as {{ user.email }}.</p>
      }

      @if (error(); as message) {
        <p class="admin-status is-error" role="status">{{ message }}</p>
      } @else if (posts(); as list) {
        @if (list.length === 0) {
          <p>No posts yet. <a routerLink="/admin/posts/new">Write the first one.</a></p>
        } @else {
          <table class="admin-posts">
            <caption class="visually-hidden">
              All posts, most recently edited first
            </caption>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">State</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              @for (post of list; track post.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/admin/posts', post.id]">{{ post.title }}</a>
                    <small>/blog/{{ post.slug }}</small>
                  </td>
                  <td>
                    @if (post.status === 'draft') {
                      Draft
                    } @else if (post.scheduled) {
                      Scheduled
                    } @else {
                      Published
                    }
                  </td>
                  <td>
                    @if (post.publishedAt) {
                      <time [attr.datetime]="post.publishedAt">
                        {{ post.publishedAt | date: 'mediumDate' }}
                      </time>
                    } @else {
                      —
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      } @else {
        <p>Loading…</p>
      }
    </section>
  `,
  styles: `
    .admin-dashboard-head {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
    }

    .admin-posts {
      inline-size: 100%;
      margin-block-start: 1rem;
      border-collapse: collapse;
    }

    .admin-posts th,
    .admin-posts td {
      padding-block: 0.5rem;
      padding-inline-end: 1rem;
      text-align: start;
      vertical-align: top;
      border-block-end: 1px solid var(--anx-sys-color-outline, currentColor);
    }

    .admin-posts small {
      display: block;
      opacity: 0.7;
    }

    .admin-status.is-error {
      color: var(--anx-sys-color-error, currentColor);
    }

    /* Table captions carry the context a screen reader needs and sighted
       readers get from the heading above. */
    .visually-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  readonly auth = inject(AuthService);
  private readonly api = inject(PostsApi);

  /** Null while loading, so an empty list is not mistaken for one. */
  readonly posts = signal<AdminPostSummary[] | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    const site = inject(SITE_IDENTITY);
    inject(SeoService).apply({
      title: 'Posts',
      description: `Administration for ${site.name}.`,
      path: '/admin',
      noIndex: true,
    });

    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.posts.set(await this.api.list());
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Could not load posts.',
      );
    }
  }
}
