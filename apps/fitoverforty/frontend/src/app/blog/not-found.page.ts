import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  constructor() {
    setServerStatus(404);
  }
}
