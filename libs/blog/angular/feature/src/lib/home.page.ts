import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_IDENTITY } from '@fitoverforty/site-angular';
import type { Paged, PostSummary } from '@fitoverforty/blog-ts';
import { SeoService } from '@fitoverforty/seo-angular';
import type { Loaded } from '@fitoverforty/blog-angular-data-access';
import { LoadErrorComponent } from '@fitoverforty/blog-angular-ui';
import { PostSummaryListComponent } from '@fitoverforty/blog-angular-ui';
import { NewsletterCtaComponent } from '@fitoverforty/newsletter-angular';

@Component({
  selector: 'fitoverforty-home-page',
  standalone: true,
  imports: [
    PostSummaryListComponent,
    RouterLink,
    LoadErrorComponent,
    NewsletterCtaComponent,
  ],
  template: `
    <section class="anx-section blog-home">
      <h1>{{ identity.name }}</h1>
      <p class="blog-home-intro">{{ identity.description }}</p>
      <h2 class="blog-section-label">Latest</h2>
      @if (latest(); as result) {
        @if (result.ok) {
          <fitoverforty-post-summary-list [posts]="result.data.items" />
          @if (result.data.totalItems > result.data.items.length) {
            <p><a routerLink="/blog">All posts</a></p>
          }
        } @else {
          <fitoverforty-load-error />
        }
      }
      <fitoverforty-newsletter-cta />
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  readonly latest = input.required<Loaded<Paged<PostSummary>>>();

  private readonly seo = inject(SeoService);
  protected readonly identity = inject(SITE_IDENTITY);

  constructor() {
    effect(() => {
      this.seo.apply({
        title: this.identity.name,
        description: this.identity.description,
        path: '/',
      });
    });
  }
}
