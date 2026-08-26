import { ChangeDetectionStrategy, Component } from '@angular/core';
import { setServerStatus } from './server-status';

/**
 * Shown when content could not be fetched — deliberately distinct from an
 * empty list, and served with a 503 when server-rendered so that a backend
 * outage is not cached or indexed as a successful, empty page.
 */
@Component({
  selector: 'app-load-error',
  standalone: true,
  template: `
    <p class="blog-load-error" role="alert">
      Posts could not be loaded just now. Please try again shortly.
    </p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadErrorComponent {
  constructor() {
    setServerStatus(503);
  }
}
