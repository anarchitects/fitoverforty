import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Paged, PostSummary } from '@fitoverforty/content-model';
import type { Loaded } from './loaded';
import { LoadErrorComponent } from './load-error.component';
import { PaginationComponent } from './pagination.component';
import { PostSummaryListComponent } from './post-summary-list.component';

@Component({
  selector: 'app-blog-archive-page',
  standalone: true,
  imports: [PostSummaryListComponent, PaginationComponent, LoadErrorComponent],
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
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogArchivePage {
  /** Bound from the route resolver by withComponentInputBinding(). */
  readonly posts = input.required<Loaded<Paged<PostSummary>>>();
}
