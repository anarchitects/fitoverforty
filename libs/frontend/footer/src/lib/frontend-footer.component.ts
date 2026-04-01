import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'fitoverforty-frontend-footer',
  standalone: true,
  template: `
    <footer class="anx-section anx-footer">
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
      justify-content: center;
    }

    .anx-footer__text {
      margin: 0;
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FitoverfortyFrontendFooterComponent {
  protected readonly currentYear = new Date().getFullYear();
}
