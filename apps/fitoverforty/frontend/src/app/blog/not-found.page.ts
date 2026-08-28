import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '@fitoverforty/seo-angular';
import { setServerStatus } from './server-status';

/**
 * Renders the body of a 404, and sets the status to match when server-rendered.
 * Under client rendering the status is whatever served index.html, because
 * there is no server in that path to tell.
 */
@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="anx-section blog-not-found">
      <h1>Not found</h1>
      <p>That page does not exist, or is not published yet.</p>
      <p><a routerLink="/blog">Back to the blog</a></p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {
  private readonly seo = inject(SeoService);

  constructor() {
    setServerStatus(404);
    this.seo.apply({
      title: 'Not found',
      description: 'That page does not exist, or is not published yet.',
      // noIndex, so no canonical is emitted and this path is never used.
      path: '/404',
      noIndex: true,
    });
  }
}
