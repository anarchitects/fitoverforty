import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'fitoverforty-frontend-header',
  standalone: true,
  template: `
    <header class="anx-section">
      <!--
        Deliberately not an h1. This renders on every page, and the page's own
        title is the document's real first-level heading; two h1s per page is
        wrong for both assistive technology and search engines.
      -->
      <p class="anx-heading">Fit Over Forty</p>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FitoverfortyFrontendHeaderComponent {}
