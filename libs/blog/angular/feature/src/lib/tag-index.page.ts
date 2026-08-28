import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { TagSummary } from '@fitoverforty/blog-ts';
import { SeoService } from '@fitoverforty/seo-angular';
import type { Loaded } from '@fitoverforty/blog-angular-data-access';
import { LoadErrorComponent } from '@fitoverforty/blog-angular-ui';

@Component({
  selector: 'fitoverforty-tag-index-page',
  standalone: true,
  imports: [RouterLink, LoadErrorComponent],
  template: `
    <section class="anx-section blog-tag-index">
      <h1>Tags</h1>
      @if (tags(); as result) {
        @if (result.ok) {
          @if (result.data.length) {
            <ul class="blog-tag-list">
              @for (tag of result.data; track tag.slug) {
                <li>
                  <a [routerLink]="['/blog/tag', tag.slug]">{{ tag.name }}</a>
                  <span class="blog-tag-count">
                    {{ tag.postCount }}
                    {{ tag.postCount === 1 ? 'post' : 'posts' }}
                  </span>
                </li>
              }
            </ul>
          } @else {
            <p class="blog-empty">No tags yet.</p>
          }
        } @else {
          <fitoverforty-load-error />
        }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagIndexPage {
  readonly tags = input.required<Loaded<TagSummary[]>>();

  private readonly seo = inject(SeoService);

  constructor() {
    effect(() => {
      this.seo.apply({
        title: 'Tags',
        description: 'Browse posts by topic.',
        path: '/blog/tags',
      });
    });
  }
}
