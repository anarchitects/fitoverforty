import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { PostSummary } from '@fitoverforty/content-model';

/**
 * Semantic markup only. Post cards proper wait on the styling direction
 * (spec §11) — this exists so the archive is navigable in the meantime.
 */
@Component({
  selector: 'app-post-summary-list',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    @if (posts().length) {
      <ul class="blog-post-list">
        @for (post of posts(); track post.slug) {
          <li class="blog-post-card">
            <article>
              <h2>
                <a [routerLink]="['/blog', post.slug]">{{ post.title }}</a>
              </h2>
              <p class="blog-post-meta">
                <time [attr.datetime]="post.publishedAt">
                  {{ post.publishedAt | date: 'longDate' }}
                </time>
                <span> · {{ post.readingTimeMinutes }} min read</span>
                @if (post.authors.length) {
                  <span>
                    · by
                    @for (author of post.authors; track author.id) {
                      {{ author.name }}
                    }
                  </span>
                }
              </p>
              <p class="blog-post-description">{{ post.description }}</p>
              @if (post.tags.length) {
                <ul class="blog-tag-list">
                  @for (tag of post.tags; track tag.slug) {
                    <li>
                      <a [routerLink]="['/blog/tag', tag.slug]">{{
                        tag.name
                      }}</a>
                    </li>
                  }
                </ul>
              }
            </article>
          </li>
        }
      </ul>
    } @else {
      <p class="blog-empty">{{ emptyMessage() }}</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostSummaryListComponent {
  readonly posts = input.required<PostSummary[]>();
  readonly emptyMessage = input('Nothing published yet.');
}
