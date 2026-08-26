import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import type { Paged, PostSummary } from '@fitoverforty/content-model';
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

  private readonly title = inject(Title);

  constructor() {
    effect(() => {
      this.title.setTitle(
        `Tagged \u201C${this.tag()}\u201D \u2014 Fit Over Forty`,
      );
    });
  }
}
