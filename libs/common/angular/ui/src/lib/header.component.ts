import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ThemeToggleComponent } from './theme-toggle.component';

@Component({
  selector: 'fitoverforty-header',
  standalone: true,
  imports: [ThemeToggleComponent],
  template: `
    <header class="anx-section anx-header">
      <!--
        Deliberately not an h1. This renders on every page, and the page's own
        title is the document's real first-level heading; two h1s per page is
        wrong for both assistive technology and search engines.
      -->
      <p class="anx-heading">Fit Over Forty</p>
      <fitoverforty-theme-toggle />
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {}
