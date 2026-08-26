import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Renders the body of a 404. Setting an actual 404 *status* needs the server
 * renderer (Angular's RESPONSE_INIT), so under client rendering this is a 200
 * carrying not-found content. That is tracked with the rest of the SSR wiring.
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
export class NotFoundPage {}
