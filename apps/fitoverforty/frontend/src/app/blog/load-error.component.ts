import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Shown when content could not be fetched — deliberately distinct from an
 * empty list. Returning a 5xx status alongside this needs the server renderer,
 * and is tracked with the rest of the SSR wiring.
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
export class LoadErrorComponent {}
