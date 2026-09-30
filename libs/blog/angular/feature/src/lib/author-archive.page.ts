import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import type {
  AuthorProfile,
  Paged,
  PostSummary,
} from '@fitoverforty/blog-ts';
import { SeoService } from '@fitoverforty/seo-angular';
import { SITE_IDENTITY } from '@fitoverforty/site-angular';
import type { Loaded } from '@fitoverforty/blog-angular-data-access';
import {
  LoadErrorComponent,
  PaginationComponent,
  PostSummaryListComponent,
} from '@fitoverforty/blog-angular-ui';
import { NotFoundPage } from './not-found.page';

/**
 * One author, and what they have written.
 *
 * Unlike the pillar archive, an author with no posts is not a 404. A pillar is
 * a fixed set of four, so an unknown slug there is a wrong URL; an author row
 * exists as soon as somebody is credited, and may legitimately have nothing
 * published — the byline still links here, and a dead link is worse than a
 * page that says so.
 */
@Component({
  selector: 'fitoverforty-author-archive-page',
  standalone: true,
  imports: [
    PostSummaryListComponent,
    PaginationComponent,
    LoadErrorComponent,
    NotFoundPage,
  ],
  template: `
    @if (failed()) {
      <fitoverforty-load-error />
    } @else if (profile(); as author) {
      <section class="anx-section blog-author">
        <header class="blog-author-header">
          @if (author.avatar; as avatar) {
            <!--
              Empty alt on purpose. The name is written out directly beside it,
              so describing the portrait would make a screen reader announce
              the same person twice.
            -->
            <img
              class="blog-author-avatar"
              [src]="avatar.src"
              [width]="avatar.width"
              [height]="avatar.height"
              alt=""
            />
          }
          <div>
            <h1>{{ author.name }}</h1>
            <p class="blog-author-count">{{ postCountLabel() }}</p>
          </div>
        </header>

        @if (author.bio) {
          <p class="blog-author-bio">{{ author.bio }}</p>
        }

        @if (posts(); as result) {
          @if (result.ok) {
            <fitoverforty-post-summary-list
              [posts]="result.data.items"
              emptyMessage="Nothing published yet."
            />
            <fitoverforty-pagination
              [page]="result.data.page"
              [totalPages]="result.data.totalPages"
              [basePath]="['/blog/author', slug()]"
            />
          } @else {
            <fitoverforty-load-error />
          }
        }
      </section>
    } @else {
      <!-- Loaded fine, and there is no such author. -->
      <fitoverforty-not-found-page />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorArchivePage {
  readonly slug = input.required<string>();
  readonly author = input.required<Loaded<AuthorProfile | undefined>>();
  readonly posts = input.required<Loaded<Paged<PostSummary>>>();

  /**
   * Narrowed here rather than in the template: Angular's template type checker
   * narrows an `@if` but not the negated `@else if` branch after it.
   */
  protected readonly failed = computed(() => !this.author().ok);

  protected readonly profile = computed(() => {
    const result = this.author();
    return result.ok ? result.data : undefined;
  });

  protected readonly postCountLabel = computed(() => {
    const count = this.profile()?.postCount ?? 0;
    // Spelled out rather than "1 posts", which reads as a bug to a reader
    // even though it is only a plural.
    return count === 1 ? '1 post' : `${count} posts`;
  });

  private readonly seo = inject(SeoService);
  private readonly identity = inject(SITE_IDENTITY);

  constructor() {
    effect(() => {
      const author = this.profile();
      if (!author) {
        // NotFoundPage sets its own metadata when it renders.
        return;
      }
      this.seo.apply({
        title: author.name,
        description:
          author.bio ?? `Posts by ${author.name} on ${this.identity.name}.`,
        path: `/blog/author/${author.slug}`,
      });
    });
  }
}
