import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import type { Paged, PostSummary } from '@fitoverforty/content-model';
import { SeoService } from '../seo/seo.service';
import type { Loaded } from './loaded';
import { LoadErrorComponent } from './load-error.component';
import { PaginationComponent } from './pagination.component';
import { PostSummaryListComponent } from './post-summary-list.component';

@Component({
  selector: 'app-tag-archive-page',
  standalone: true,
  imports: [PostSummaryListComponent, PaginationComponent, LoadErrorComponent],
  template: `
    <section class="anx-section blog-tag-archive">
      <h1>Tagged “{{ tag() }}”</h1>
      @if (posts(); as result) {
        @if (result.ok) {
          <app-post-summary-list
            [posts]="result.data.items"
            emptyMessage="Nothing tagged that yet."
          />
          <app-pagination
            [page]="result.data.page"
            [totalPages]="result.data.totalPages"
            [basePath]="['/blog/tag', tag()]"
          />
        } @else {
          <app-load-error />
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
