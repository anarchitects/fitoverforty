import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import type { Paged, PostSummary } from '@fitoverforty/blog-ts';
import { SeoService } from '@fitoverforty/seo-angular';
import type { Loaded } from '@fitoverforty/blog-angular-data-access';
import { LoadErrorComponent } from '@fitoverforty/blog-angular-ui';
import { PaginationComponent } from '@fitoverforty/blog-angular-ui';
import { PostSummaryListComponent } from '@fitoverforty/blog-angular-ui';
import { NewsletterCtaComponent } from '@fitoverforty/newsletter-angular';

@Component({
  selector: 'fitoverforty-blog-archive-page',
  standalone: true,
  imports: [
    PostSummaryListComponent,
    PaginationComponent,
    LoadErrorComponent,
    NewsletterCtaComponent,
  ],
  template: `
    <section class="anx-section blog-archive">
      <h1>Blog</h1>
      @if (posts(); as result) {
        @if (result.ok) {
          <fitoverforty-post-summary-list [posts]="result.data.items" />
          <fitoverforty-pagination
            [page]="result.data.page"
            [totalPages]="result.data.totalPages"
            [basePath]="['/blog']"
          />
        } @else {
          <fitoverforty-load-error />
        }
      }
      <fitoverforty-newsletter-cta />
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogArchivePage {
  /** Bound from the route resolver by withComponentInputBinding(). */
  readonly posts = input.required<Loaded<Paged<PostSummary>>>();

  private readonly seo = inject(SeoService);

  constructor() {
    effect(() => {
      const result = this.posts();
      const page = result.ok ? result.data.page : 1;
      this.seo.apply({
        title: page > 1 ? `Blog, page ${page}` : 'Blog',
        description:
          'Every post: training, recovery and nutrition for people over forty.',
        // Page 1 canonicalises to /blog so the two URLs are not duplicates.
        path: page > 1 ? `/blog/page/${page}` : '/blog',
      });
    });
  }
}
