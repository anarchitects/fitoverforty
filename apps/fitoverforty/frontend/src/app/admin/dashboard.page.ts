import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../seo/seo.service';
import { AuthService } from './auth.service';

/**
 * The admin landing page.
 *
 * It says what is not built yet rather than showing empty panels for it. An
 * authoring UI that looks present but does nothing is harder to reason about
 * than one that is honestly absent.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="anx-section">
      <h1>Dashboard</h1>

      @if (auth.user(); as user) {
        <p>Signed in as {{ user.email }}.</p>
      }

      <p>
        Authoring is partly built. The
        <a routerLink="/admin/compose">editor</a> works, but nothing saves yet:
        media uploads and the publish workflow are the remaining Phase B steps,
        and until they land posts are seeded through a migration.
      </p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  readonly auth = inject(AuthService);

  constructor() {
    inject(SeoService).apply({
      title: 'Dashboard',
      description: 'Administration for Fit Over Forty.',
      path: '/admin',
      noIndex: true,
    });
  }
}
