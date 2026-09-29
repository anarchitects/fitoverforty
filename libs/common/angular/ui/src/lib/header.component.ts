import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LogoComponent } from './logo.component';
import { ThemeToggleComponent } from './theme-toggle.component';

@Component({
  selector: 'fitoverforty-header',
  standalone: true,
  imports: [LogoComponent, ThemeToggleComponent],
  template: `
    <header class="anx-section anx-header">
      <!--
        Deliberately not an h1, and the mark does not change that. This renders
        on every page, and the page's own title is the document's real
        first-level heading; two h1s per page is wrong for both assistive
        technology and search engines.

        The mark carries the site's name itself, as an img role with a title,
        so it is announced here rather than being decoration beside a name that
        is no longer written out.
      -->
      <p class="anx-heading fitoverforty-brand">
        <fitoverforty-logo orientation="inline" label="Fit Over Forty" />
      </p>
      <fitoverforty-theme-toggle />
    </header>
  `,
  styles: `
    /*
      Sized by height; the width follows from the component's own aspect ratio.
      The margin reset is because .anx-heading is a paragraph and brings the
      block margins of one, which would push the mark off the header's centre.
    */
    .fitoverforty-brand {
      display: flex;
      margin: 0;
      block-size: 3.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {}
