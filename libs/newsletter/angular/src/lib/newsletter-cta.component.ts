import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CONSENT_TEXT } from './consent';

type State = 'idle' | 'sending' | 'sent' | 'error';

/**
 * A deliberately small, bespoke form rather than a forms-angular render
 * (spec §12).
 *
 * It appears on every page, and fetching a form definition to draw one email
 * field and a checkbox would mean a request per page. The server side still
 * mirrors the forms-nest delivery shape, so this can collapse into that stack
 * if it ever grows a subscriber target.
 */
@Component({
  selector: 'fitoverforty-newsletter-cta',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="blog-newsletter" aria-labelledby="newsletter-heading">
      <h2 id="newsletter-heading">Get new posts by email</h2>

      @if (state() === 'sent') {
        <p class="blog-newsletter-done" role="status">
          Almost there — check your inbox and confirm the subscription. If it
          does not arrive, look in your spam folder.
        </p>
      } @else {
        <!--
          The button is type="button", not type="submit", and that is
          load-bearing. Before hydration completes there is no Angular listener
          to call preventDefault, so a submit button performs a native GET and
          navigates to ?email=... — putting the subscriber's address in the URL,
          their history, and the server log. With no submit button present, and
          more than one field, browsers also suppress implicit submission on
          Enter, which closes the same hole.

          The (submit) binding stays as a backstop for anything that manages to
          submit the form once hydrated.
        -->
        <form (submit)="submit($event)" novalidate>
          <label class="blog-newsletter-field" for="newsletter-email">
            Email address
            <input
              id="newsletter-email"
              name="email"
              type="email"
              autocomplete="email"
              required
              [value]="email()"
              (input)="email.set(asValue($event))"
              [attr.aria-invalid]="state() === 'error' ? 'true' : null"
              [attr.aria-describedby]="
                state() === 'error' ? 'newsletter-error' : null
              "
            />
          </label>

          <!--
            The honeypot. Hidden from people, left in the DOM for bots.
            aria-hidden and tabindex keep it away from assistive technology.
          -->
          <div class="blog-newsletter-hp" aria-hidden="true">
            <label for="newsletter-website">Website</label>
            <input
              id="newsletter-website"
              name="website"
              type="text"
              tabindex="-1"
              autocomplete="off"
              [value]="honeypot()"
              (input)="honeypot.set(asValue($event))"
            />
          </div>

          <label class="blog-newsletter-consent">
            <!--
              Unticked, and separate from any other purpose. Pre-ticking it
              would not be consent.
            -->
            <input
              type="checkbox"
              name="consent"
              [checked]="consent()"
              (change)="consent.set(asChecked($event))"
            />
            <span>{{ consentText }}</span>
          </label>

          <p class="blog-newsletter-privacy">
            <a routerLink="/privacy">How we handle your data</a>
          </p>

          <button
            type="button"
            [disabled]="state() === 'sending'"
            (click)="submit($event)"
          >
            {{ state() === 'sending' ? 'Subscribing…' : 'Subscribe' }}
          </button>

          @if (message(); as text) {
            <!--
              role=alert announces the message when it appears;
              aria-describedby on the input is what makes it reachable
              afterwards, when someone tabs back to the field to fix it. The
              two do different jobs and both are needed - with only the alert,
              returning to the field says "invalid" and nothing more.
            -->
            <p id="newsletter-error" class="blog-newsletter-error" role="alert">
              {{ text }}
            </p>
          }
        </form>
      }
    </section>
  `,
  // The only styling in this component, and deliberately so (spec §11 defers
  // the rest): the honeypot has to be invisible for the form to make sense to
  // a person, whatever the design direction turns out to be.
  styles: `
    .blog-newsletter-hp {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsletterCtaComponent {
  protected readonly consentText = CONSENT_TEXT;

  protected readonly email = signal('');
  protected readonly consent = signal(false);
  protected readonly honeypot = signal('');
  protected readonly state = signal<State>('idle');
  protected readonly message = signal<string | null>(null);

  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  protected asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected asChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.message.set(null);

    if (!this.email().trim()) {
      this.message.set('Please enter your email address.');
      this.state.set('error');
      return;
    }
    if (!this.consent()) {
      this.message.set('Please tick the box to confirm you want these emails.');
      this.state.set('error');
      return;
    }

    this.state.set('sending');
    try {
      await firstValueFrom(
        this.http.post('/api/newsletter/subscribe', {
          email: this.email().trim(),
          consent: true,
          website: this.honeypot(),
          source: this.document.location?.pathname,
        }),
      );
      this.state.set('sent');
    } catch (error) {
      this.state.set('error');
      this.message.set(
        error instanceof HttpErrorResponse && error.status === 400
          ? 'That address did not look right. Please check and try again.'
          : 'Something went wrong. Please try again shortly.',
      );
    }
  }
}
