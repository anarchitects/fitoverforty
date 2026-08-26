import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { BlockRendererComponent } from '@fitoverforty/frontend-blog';
import { isBlocksBody, type Post } from '@fitoverforty/content-model';
import type { Loaded } from './loaded';
import { LoadErrorComponent } from './load-error.component';
import { NotFoundPage } from './not-found.page';

@Component({
  selector: 'app-post-detail-page',
  standalone: true,
  imports: [
    BlockRendererComponent,
    DatePipe,
    RouterLink,
    NotFoundPage,
    LoadErrorComponent,
  ],
  template: `
    @if (failed()) {
      <app-load-error />
    } @else if (loadedPost(); as loaded) {
      <article class="anx-section blog-post">
        <header class="blog-post-header">
          <h1>{{ loaded.title }}</h1>
          <p class="blog-post-meta">
            <time [attr.datetime]="loaded.publishedAt">
              {{ loaded.publishedAt | date: 'longDate' }}
            </time>
            <span> · {{ loaded.readingTimeMinutes }} min read</span>
            @if (loaded.authors.length) {
              <span>
                · by
                @for (author of loaded.authors; track author.id) {
                  {{ author.name }}
                }
              </span>
            }
          </p>
          @if (loaded.tags.length) {
            <ul class="blog-tag-list">
              @for (tag of loaded.tags; track tag.slug) {
                <li>
                  <a [routerLink]="['/blog/tag', tag.slug]">{{ tag.name }}</a>
                </li>
              }
            </ul>
          }
        </header>

        @if (blocks(); as body) {
          <fitoverforty-block-renderer [blocks]="body" />
        } @else {
          <!--
              The html variant of PostBody exists for imported content and is
              not written today. Rendering it needs a separate, sanitised path
              rather than being quietly folded in here.
            -->
          <p class="blog-empty">This post cannot be displayed.</p>
        }
      </article>
    } @else {
      <!-- Loaded fine, but there is no such published post. -->
      <app-not-found-page />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostDetailPage {
  /**
   * `ok: false` is a failure to reach the API; `ok: true` with no data is a
   * genuine 404. Collapsing the two would tell readers a post does not exist
   * whenever the backend hiccups.
   */
  readonly post = input.required<Loaded<Post | undefined>>();

  /**
   * Narrowing happens here rather than in the template: Angular's template
   * type checker narrows `@if (x.ok)` but not the negated `@else if` branch.
   */
  protected readonly failed = computed(() => !this.post().ok);

  protected readonly loadedPost = computed(() => {
    const result = this.post();
    return result.ok ? result.data : undefined;
  });

  private readonly title = inject(Title);

  constructor() {
    // Set here rather than as a route `title` resolver: that would race with
    // the post resolver it depends on. Description, canonical, OpenGraph and
    // JSON-LD land with the rest of the SEO work.
    effect(() => {
      const post = this.loadedPost();
      this.title.setTitle(
        post ? `${post.title} — Fit Over Forty` : 'Not found — Fit Over Forty',
      );
    });
  }

  protected readonly blocks = computed(() => {
    const loaded = this.loadedPost();
    if (!loaded) return undefined;
    return isBlocksBody(loaded.body) ? loaded.body.blocks : undefined;
  });
}
