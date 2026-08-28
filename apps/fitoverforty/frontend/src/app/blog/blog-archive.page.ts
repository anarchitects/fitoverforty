import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import type { Paged, PostSummary } from '@fitoverforty/content-model';
import { SeoService } from '@fitoverforty/seo-angular';
import type { Loaded } from './loaded';
import { LoadErrorComponent } from './load-error.component';
import { PaginationComponent } from './pagination.component';
import { PostSummaryListComponent } from './post-summary-list.component';
import { NewsletterCtaComponent } from '../newsletter/newsletter-cta.component';

@Component({
  selector: 'app-blog-archive-page',
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
          <app-post-summary-list [posts]="result.data.items" />
          <app-pagination
            [page]="result.data.page"
            [totalPages]="result.data.totalPages"
            [basePath]="['/blog']"
          />
        } @else {
          <app-load-error />
        }
      }
      <app-newsletter-cta />
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
