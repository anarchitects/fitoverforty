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
import {
  BlockRendererComponent,
  PostSummaryListComponent,
} from '@fitoverforty/blog-angular-ui';
import {
  isBlocksBody,
  type Post,
  type PostSummary,
} from '@fitoverforty/blog-ts';
import { SeoService } from '@fitoverforty/seo-angular';
import type { Loaded } from '@fitoverforty/blog-angular-data-access';
import { LoadErrorComponent } from '@fitoverforty/blog-angular-ui';
import { NotFoundPage } from './not-found.page';
import { NewsletterCtaComponent } from '@fitoverforty/newsletter-angular';

@Component({
  selector: 'fitoverforty-post-detail-page',
  standalone: true,
  imports: [
    BlockRendererComponent,
    DatePipe,
    RouterLink,
    NotFoundPage,
    LoadErrorComponent,
    NewsletterCtaComponent,
    PostSummaryListComponent,
  ],
  template: `
    @if (failed()) {
      <fitoverforty-load-error />
    } @else if (loadedPost(); as loaded) {
      <article class="anx-section blog-post">
        @if (loaded.hero; as hero) {
          <!--
            Above the title, at content width. Width and height are the
            stored intrinsic dimensions rather than the rendered size: they
            give the browser an aspect ratio to reserve before the bytes
            arrive, so the title does not jump down the page as it loads.
            The CSS caps how large a small image is allowed to become.

            No lazy loading and fetchpriority high: this is the largest
            element above the fold, so deferring it is deferring the thing
            the page is judged on.
          -->
          <img
            class="blog-post-hero"
            [src]="hero.src"
            [alt]="hero.alt"
            [attr.width]="hero.width"
            [attr.height]="hero.height"
            fetchpriority="high"
          />
        }
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
                @for (
                  author of loaded.authors;
                  track author.id;
                  let last = $last
                ) {
                  <a [routerLink]="['/blog/author', author.slug]">{{
                    author.name
                  }}</a>@if (!last) {<span>, </span>}
                }
              </span>
            }
          </p>
          @if (loaded.pillar; as pillar) {
            <p class="blog-post-pillar">
              <a [routerLink]="['/blog/pillar', pillar.slug]">
                {{ pillar.name }}
              </a>
            </p>
          }
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

      @if (relatedPosts().length) {
        <!--
          Before the newsletter CTA, not after it. A reader who has just
          finished a post is more likely to read another than to subscribe,
          and burying the onward links under a form makes the post a dead end
          for everyone who does not subscribe.
        -->
        <section class="anx-section blog-related">
          <h2 class="blog-section-label">Keep reading</h2>
          <fitoverforty-post-summary-list [posts]="relatedPosts()" />
        </section>
      }

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
      <fitoverforty-not-found-page />
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
  /**
   * Resolved alongside the post. A failure here is not a failure of the page:
   * the post is what the reader came for, so an unreachable related-posts
   * call renders nothing rather than an error.
   */
  readonly related = input.required<Loaded<PostSummary[]>>();

  protected readonly relatedPosts = computed(() => {
    const result = this.related();
    return result.ok ? result.data : [];
  });

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
        /**
         * The hero when there is one, and a generated card when there is not.
         * A post's own photograph is a better preview than anything drawn
         * from its title, so this only falls back.
         */
        image: post.hero?.src ?? `/og/blog/${post.slug}.png`,
      });
    });
  }

  protected readonly blocks = computed(() => {
    const loaded = this.loadedPost();
    if (!loaded) return undefined;
    return isBlocksBody(loaded.body) ? loaded.body.blocks : undefined;
  });
}
