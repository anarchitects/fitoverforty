import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import type { Paged, PillarSummary, PostSummary } from '@fitoverforty/blog-ts';
import { SeoService } from '@fitoverforty/seo-angular';
import type { Loaded } from '@fitoverforty/blog-angular-data-access';
import { LoadErrorComponent } from '@fitoverforty/blog-angular-ui';
import { PaginationComponent } from '@fitoverforty/blog-angular-ui';
import { PostSummaryListComponent } from '@fitoverforty/blog-angular-ui';
import { NotFoundPage } from './not-found.page';

/**
 * One pillar's posts.
 *
 * The pillar list is resolved alongside them, for two reasons: it is where the
 * display name comes from — the route only carries a slug, and title-casing it
 * here would duplicate what the table already holds — and it is what makes an
 * unknown slug a genuine 404. The set is fixed at four, so a made-up pillar is
 * a wrong URL rather than an empty section, and answering 200 for one would
 * invite crawlers to index nonsense.
 */
@Component({
  selector: 'fitoverforty-pillar-archive-page',
  standalone: true,
  imports: [
    PostSummaryListComponent,
    PaginationComponent,
    LoadErrorComponent,
    NotFoundPage,
  ],
  template: `
    @if (unknownPillar()) {
      <fitoverforty-not-found-page />
    } @else {
      <section class="anx-section blog-pillar-archive">
        <h1>{{ pillarName() }}</h1>
        @if (posts(); as result) {
          @if (result.ok) {
            <fitoverforty-post-summary-list
              [posts]="result.data.items"
              emptyMessage="Nothing filed here yet."
            />
            <fitoverforty-pagination
              [page]="result.data.page"
              [totalPages]="result.data.totalPages"
              [basePath]="['/blog/pillar', pillar()]"
            />
          } @else {
            <fitoverforty-load-error />
          }
        }
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PillarArchivePage {
  readonly posts = input.required<Loaded<Paged<PostSummary>>>();
  readonly pillars = input.required<Loaded<PillarSummary[]>>();
  /** Bound from the :pillar route parameter. */
  readonly pillar = input.required<string>();

  private readonly match = computed(() => {
    const list = this.pillars();
    if (!list.ok) return undefined;
    return list.data.find((p) => p.slug === this.pillar());
  });

  /**
   * Only when the list actually loaded. A failed request means we do not know
   * whether the pillar exists, and answering "not found" would turn an API
   * blip into a permanent-looking 404.
   */
  readonly unknownPillar = computed(
    () => this.pillars().ok && this.match() === undefined,
  );

  readonly pillarName = computed(() => this.match()?.name ?? '');

  private readonly seo = inject(SeoService);

  constructor() {
    effect(() => {
      // Nothing to do for an unknown pillar: NotFoundPage sets both the 404
      // and its own metadata when it renders. Calling setServerStatus here
      // would also fail — it injects RESPONSE_INIT, and an effect callback is
      // not an injection context.
      if (this.unknownPillar()) return;
      const name = this.pillarName();
      if (!name) return;
      this.seo.apply({
        title: name,
        description: `Posts on ${name.toLowerCase()}.`,
        path: `/blog/pillar/${this.pillar()}`,
      });
    });
  }
}
