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
      The height goes on the logo, not on this paragraph.

      Sizing the paragraph does nothing to the mark inside it: the logo
      component carries its own host rule of block-size 2rem, and a height on
      the wrapper does not cascade into it. The result was a 3.5rem box with a
      2rem mark sitting in it, which rendered the 40+ counter at about six
      pixels and unreadable — the wrapper looked correct in the styles and the
      mark was silently half the size it claimed.

      (No backticks in here: these styles are a template literal, and one
      closes it early.)

      3.5rem fills the header's content box exactly (the header is 80.5px with
      13.5px of padding), so the padding is what provides the breathing room.
      The width follows from the component's own aspect ratio; at 375px the
      inline lockup comes to 214px and still clears the theme toggle.

      The margin reset is because .anx-heading is a paragraph and brings the
      block margins of one, which would push the mark off the header's centre.
    */
    .fitoverforty-brand {
      display: flex;
      margin: 0;
    }

    .fitoverforty-brand fitoverforty-logo {
      block-size: 3.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {}
