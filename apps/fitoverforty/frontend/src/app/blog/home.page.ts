import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Paged, PostSummary } from '@fitoverforty/content-model';
import { SeoService } from '@fitoverforty/seo-angular';
import type { Loaded } from './loaded';
import { LoadErrorComponent } from './load-error.component';
import { PostSummaryListComponent } from './post-summary-list.component';
import { NewsletterCtaComponent } from '@fitoverforty/newsletter-angular';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    PostSummaryListComponent,
    RouterLink,
    LoadErrorComponent,
    NewsletterCtaComponent,
  ],
  template: `
    <section class="anx-section blog-home">
      <h1>Fit Over Forty</h1>
      <p class="blog-home-intro">
        Training, recovery and nutrition for people who did not start yesterday.
      </p>
      <h2>Latest</h2>
      @if (latest(); as result) {
        @if (result.ok) {
          <app-post-summary-list [posts]="result.data.items" />
          @if (result.data.totalItems > result.data.items.length) {
            <p><a routerLink="/blog">All posts</a></p>
          }
        } @else {
          <app-load-error />
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

  constructor() {
    effect(() => {
      this.seo.apply({
        title: 'Fit Over Forty',
        description:
          'Training, recovery and nutrition for people who did not start yesterday.',
        path: '/',
      });
    });
  }
}
