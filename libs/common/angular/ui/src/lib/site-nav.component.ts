import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

interface NavItem {
  readonly path: string;
  readonly label: string;
}

/**
 * The site's sections, in reading order rather than alphabetical.
 *
 * Deliberately short. A blog with four content pillars and two utility pages
 * does not need a menu that mirrors the sitemap, and every item added here
 * costs width on a phone before it earns anything.
 *
 * `/privacy` is not here: it belongs in the footer, where readers look for it
 * and where it does not compete with the sections somebody actually came to
 * read.
 */
const ITEMS: readonly NavItem[] = [
  { path: '/blog', label: 'Posts' },
  { path: '/blog/pillars', label: 'Pillars' },
  { path: '/blog/tags', label: 'Tags' },
  { path: '/about', label: 'About' },
  { path: '/contact', label: 'Contact' },
];

/**
 * Primary navigation.
 *
 * Until now the site had none: `/contact` and `/privacy` existed as routes
 * that nothing linked to, reachable only by typing the URL.
 *
 * Wide enough, the links sit in a row and the toggle is hidden. Narrow, the
 * row collapses behind a disclosure button — a plain `button` with
 * `aria-expanded` and `aria-controls`, not a `dialog` or a custom widget,
 * because "show more of this thing" is exactly what a disclosure is and a
 * native button brings its own keyboard behaviour.
 *
 * The panel closes on navigation. Without that, following a link on a phone
 * leaves the menu covering the page the reader just asked for.
 */
@Component({
  selector: 'fitoverforty-site-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="site-nav" aria-label="Primary">
      <button
        type="button"
        class="site-nav__toggle"
        [attr.aria-expanded]="open()"
        aria-controls="site-nav-list"
        (click)="toggle()"
      >
        <span aria-hidden="true" class="site-nav__toggle-icon">
          {{ open() ? '✕' : '☰' }}
        </span>
        <span class="site-nav__toggle-label">{{ toggleLabel() }}</span>
      </button>

      <ul id="site-nav-list" class="site-nav__list" [class.is-open]="open()">
        @for (item of items; track item.path) {
          <li>
            <a
              [routerLink]="item.path"
              routerLinkActive="is-current"
              [routerLinkActiveOptions]="{ exact: item.path === '/blog' }"
              ariaCurrentWhenActive="page"
            >
              {{ item.label }}
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    /*
      The host is transparent to layout, so the nav element itself is what the
      header lays out.

      Without this the flex item is fitoverforty-site-nav, an element with no
      styles of its own, and every rule written against .site-nav applies to
      something one level too deep — the open panel came out 177px wide inside
      a 375px header and the theme control ended up stranded beside the links.

      display: contents is safe here specifically because the host carries no
      semantics: the nav landmark and its label are on the element inside it,
      so nothing is removed from the accessibility tree.
    */
    :host {
      display: contents;
    }
  `,
  host: {
    // Escape closes the panel wherever focus sits inside the nav, which is
    // what a keyboard user expects of anything that opened over the page.
    '(keydown.escape)': 'close()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteNavComponent {
  protected readonly items = ITEMS;
  protected readonly open = signal(false);

  protected readonly toggleLabel = computed(() =>
    this.open() ? 'Close menu' : 'Open menu',
  );

  private readonly router = inject(Router);

  constructor() {
    /**
     * Close on navigation.
     *
     * `NavigationEnd` rather than a click handler on each link: a reader can
     * also leave by the browser's back button or by a link inside the page,
     * and the panel should not survive either.
     */
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.open.set(false));
  }

  protected toggle(): void {
    this.open.update((value) => !value);
  }

  protected close(): void {
    this.open.set(false);
  }
}
