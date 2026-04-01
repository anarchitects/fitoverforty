import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'fitoverforty-frontend-header',
  standalone: true,
  template: `
    <header class="anx-section">
      <h1 class="anx-heading">Fit Over Forty</h1>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FitoverfortyFrontendHeaderComponent {}
