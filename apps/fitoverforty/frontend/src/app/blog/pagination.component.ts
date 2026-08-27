import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (totalPages() > 1) {
      <nav class="blog-pagination" aria-label="Pagination">
        @if (page() > 1) {
          <a rel="prev" [routerLink]="linkFor(page() - 1)">Newer</a>
        }
        <span>Page {{ page() }} of {{ totalPages() }}</span>
        @if (page() < totalPages()) {
          <a rel="next" [routerLink]="linkFor(page() + 1)">Older</a>
        }
      </nav>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  /** Route prefix, e.g. ['/blog'] or ['/blog/tag', 'recovery']. */
  readonly basePath = input.required<string[]>();

  protected linkFor(page: number): string[] {
    // Page 1 keeps the clean URL so /blog and /blog/page/1 are not duplicates.
    return page === 1
      ? this.basePath()
      : [...this.basePath(), 'page', String(page)];
  }
}
