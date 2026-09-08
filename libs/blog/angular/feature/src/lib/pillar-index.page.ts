import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PillarSummary } from '@fitoverforty/blog-ts';
import { SeoService } from '@fitoverforty/seo-angular';
import type { Loaded } from '@fitoverforty/blog-angular-data-access';
import { LoadErrorComponent } from '@fitoverforty/blog-angular-ui';

/**
 * The four pillars, in their fixed order.
 *
 * Unlike the tag index this lists pillars with no posts as well. They are
 * sections rather than labels: a reader who sees three of four learns the wrong
 * thing about what this blog covers, and the empty one is the invitation to
 * write for it.
 */
@Component({
  selector: 'fitoverforty-pillar-index-page',
  standalone: true,
  imports: [RouterLink, LoadErrorComponent],
  template: `
    <section class="anx-section blog-pillar-index">
      <h1>Pillars</h1>
      <p class="blog-lede">Everything here sits under one of four headings.</p>
      @if (pillars(); as result) {
        @if (result.ok) {
          <ul class="blog-pillar-list">
            @for (pillar of result.data; track pillar.slug) {
              <li>
                <a [routerLink]="['/blog/pillar', pillar.slug]">
                  {{ pillar.name }}
                </a>
                <span class="blog-tag-count">
                  {{ pillar.postCount }}
                  {{ pillar.postCount === 1 ? 'post' : 'posts' }}
                </span>
              </li>
            }
          </ul>
        } @else {
          <fitoverforty-load-error />
        }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PillarIndexPage {
  readonly pillars = input.required<Loaded<PillarSummary[]>>();

  private readonly seo = inject(SeoService);

  constructor() {
    effect(() => {
      this.seo.apply({
        title: 'Pillars',
        description:
          'Physical, mental, emotional and financial fitness after forty.',
        path: '/blog/pillars',
      });
    });
  }
}
