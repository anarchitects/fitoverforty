import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SeoService } from '@fitoverforty/seo-angular';
import { SITE_IDENTITY } from '@fitoverforty/site-angular';
import { AuthService } from '@fitoverforty/admin-angular-data-access';

@Component({
  selector: 'fitoverforty-admin-sign-in',
  standalone: true,
  template: `
    <section class="anx-section admin-signin" aria-labelledby="signin-heading">
      <h1 id="signin-heading">Sign in</h1>

      <!--
        The buttons are type="button" with explicit handlers, and Enter is
        bound by hand, following the same reasoning as the newsletter form: a
        native submit before a listener is attached performs a GET and puts the
        field values in the URL. For a password that would mean the credential
        landing in browser history and the server log.

        These routes are client-rendered, so in practice the form does not
        exist until the bundle has run and there is no pre-hydration window.
        The pattern is kept anyway because that is a property of the route
        config, which is one edit away from changing.
      -->
      <form (submit)="$event.preventDefault()" novalidate>
        <label class="admin-field" for="signin-email">
          Email address
          <input
            id="signin-email"
            name="email"
            type="email"
            autocomplete="username"
            required
            [value]="email()"
            (input)="email.set(asValue($event))"
            (keydown.enter)="submit()"
            [attr.aria-invalid]="error() ? 'true' : null"
          />
        </label>

        <label class="admin-field" for="signin-password">
          Password
          <input
            id="signin-password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            [value]="password()"
            (input)="password.set(asValue($event))"
            (keydown.enter)="submit()"
            [attr.aria-invalid]="error() ? 'true' : null"
          />
        </label>

        @if (error(); as message) {
          <p class="admin-error" role="alert">{{ message }}</p>
        }

        <button type="button" (click)="submit()" [disabled]="busy()">
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p class="admin-note">
        There is no sign-up. Accounts are created from the command line.
      </p>
    </section>
  `,
  styles: `
    .admin-field {
      display: block;
      margin-block-end: 1rem;
    }

    .admin-field input {
      display: block;
      inline-size: 100%;
      max-inline-size: 24rem;
      margin-block-start: 0.25rem;
    }

    .admin-signin {
      max-inline-size: 28rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly email = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    const site = inject(SITE_IDENTITY);
    inject(SeoService).apply({
      title: 'Sign in',
      description: `Administration for ${site.name}.`,
      path: '/admin/sign-in',
      // robots.txt already disallows /admin; this covers a crawler that
      // reaches the URL without reading robots.txt first.
      noIndex: true,
    });
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async submit(): Promise<void> {
    if (this.busy()) return;

    const email = this.email().trim();
    const password = this.password();
    if (!email || !password) {
      this.error.set('Enter both an email address and a password.');
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    try {
      const failure = await this.auth.signIn(email, password);
      if (failure) {
        this.error.set(failure);
        return;
      }
      /**
       * Only relative paths are followed. `returnUrl` comes from the query
       * string, so honouring an absolute one would turn the sign-in page into
       * an open redirect: a link to /admin/sign-in?returnUrl=https://elsewhere
       * would bounce a freshly-authenticated admin off-site.
       */
      const requested = this.route.snapshot.queryParamMap.get('returnUrl');
      const target =
        requested && requested.startsWith('/') && !requested.startsWith('//')
          ? requested
          : '/admin';
      await this.router.navigateByUrl(target);
    } finally {
      this.busy.set(false);
    }
  }
}
