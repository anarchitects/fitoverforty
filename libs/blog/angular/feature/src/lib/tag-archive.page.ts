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

@Component({
  selector: 'fitoverforty-tag-archive-page',
  standalone: true,
  imports: [PostSummaryListComponent, PaginationComponent, LoadErrorComponent],
  template: `
    <section class="anx-section blog-tag-archive">
      <h1>Tagged “{{ tag() }}”</h1>
      @if (posts(); as result) {
        @if (result.ok) {
          <fitoverforty-post-summary-list
            [posts]="result.data.items"
            emptyMessage="Nothing tagged that yet."
          />
          <fitoverforty-pagination
            [page]="result.data.page"
            [totalPages]="result.data.totalPages"
            [basePath]="['/blog/tag', tag()]"
          />
        } @else {
          <fitoverforty-load-error />
        }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagArchivePage {
  readonly posts = input.required<Loaded<Paged<PostSummary>>>();
  /** Bound from the :tag route parameter. */
  readonly tag = input.required<string>();

  private readonly seo = inject(SeoService);

  constructor() {
    effect(() => {
      const tag = this.tag();
      this.seo.apply({
        title: `Tagged \u201C${tag}\u201D`,
        description: `Posts tagged ${tag}.`,
        path: `/blog/tag/${tag}`,
      });
    });
  }
}
