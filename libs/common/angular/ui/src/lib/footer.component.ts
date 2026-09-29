import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * The footer, and the only route to the privacy notice.
 *
 * Privacy lives here rather than in the primary navigation: readers look for
 * it at the bottom of a page, and in the header it would compete with the
 * sections somebody actually came to read. Until now nothing linked to it at
 * all — it was a route reachable only by typing the URL.
 *
 * The feed is here for the same reason. It is a real way to follow the blog,
 * and the discovery link in the head only helps software; a person needs
 * something to click.
 */
@Component({
  selector: 'fitoverforty-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="anx-section anx-footer">
      <nav class="anx-footer__links" aria-label="Footer">
        <a routerLink="/privacy">Privacy</a>
        <a routerLink="/contact">Contact</a>
        <!--
          A real href, not a routerLink: the feed is served by the backend
          outside the Angular application, so routing to it would look for a
          page that does not exist.
        -->
        <a href="/blog/feed.xml">RSS</a>
      </nav>
      <p class="anx-text anx-footer__text">
        © {{ currentYear }} Fit Over Forty. All rights reserved.
      </p>
    </footer>
  `,
  styles: `
    :host {
      display: block;
    }

    .anx-footer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .anx-footer__links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.25rem;
      font-size: 0.875rem;
    }

    .anx-footer__links a {
      color: var(--anx-sys-color-text-muted);
      text-decoration: none;
    }

    .anx-footer__links a:hover {
      color: var(--anx-sys-color-accent);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    .anx-footer__text {
      margin: 0;
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  protected readonly currentYear = new Date().getFullYear();
}
