import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BlockRendererComponent } from '@fitoverforty/frontend-blog';
import { isBlocksBody, type Post } from '@fitoverforty/content-model';
import { SeoService } from '@fitoverforty/seo-angular';
import type { Loaded } from './loaded';
import { LoadErrorComponent } from './load-error.component';
import { NotFoundPage } from './not-found.page';
import { NewsletterCtaComponent } from '@fitoverforty/newsletter-angular';

@Component({
  selector: 'app-post-detail-page',
  standalone: true,
  imports: [
    BlockRendererComponent,
    DatePipe,
    RouterLink,
    NotFoundPage,
    LoadErrorComponent,
    NewsletterCtaComponent,
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

      <!--
        Inside the loaded branch, not below it. The CTA belongs at the foot of
        a post somebody just read — offering a subscription under a "no such
        post" page is asking for an email address as an apology.

        This tag was missing between #18 and now: the import was added and the
        element was not, so the compiler warned on every build and the one page
        §12 most wants the CTA on was the one page without it. RSS ships item
        descriptions rather than full bodies precisely so readers arrive here.
      -->
      <fitoverforty-newsletter-cta />
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

  private readonly seo = inject(SeoService);

  constructor() {
    // Set here rather than as a route `title` resolver: that would race with
    // the post resolver it depends on.
    effect(() => {
      const post = this.loadedPost();
      if (!post) {
        // NotFoundPage sets its own metadata when it renders.
        return;
      }
      this.seo.apply({
        title: post.title,
        description: post.description,
        path: `/blog/${post.slug}`,
        type: 'article',
        publishedAt: post.publishedAt,
        modifiedAt: post.updatedAt,
        authors: post.authors.map((author) => author.name),
        tags: post.tags.map((tag) => tag.name),
        image: post.hero?.src,
      });
    });
  }

  protected readonly blocks = computed(() => {
    const loaded = this.loadedPost();
    if (!loaded) return undefined;
    return isBlocksBody(loaded.body) ? loaded.body.blocks : undefined;
  });
}
