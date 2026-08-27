import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../seo/seo.service';
import { CONSENT_TEXT } from '../newsletter/consent';

/**
 * A v1 requirement, not a nicety (spec §12): affirmative consent has to link
 * somewhere that explains what is being consented to.
 *
 * Deliberately specific about what is collected. A generic policy that does
 * not match what the code actually does is worse than none, because it reads
 * as compliance while being wrong.
 */
@Component({
  selector: 'app-privacy-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="anx-section blog-legal">
      <h1>Privacy</h1>

      <p>
        Fit Over Forty is run by two people. This page describes exactly what we
        collect, why, and what you can ask us to do about it.
      </p>

      <h2>Reading the blog</h2>
      <p>
        Nothing is required to read. We do not set advertising or tracking
        cookies, and there is no third-party analytics on these pages.
      </p>

      <h2>The newsletter</h2>
      <p>
        If you subscribe, we record your email address, the date and time, the
        page you subscribed from, your IP address, and the exact wording you
        agreed to:
      </p>
      <blockquote class="blog-quote">
        <p>{{ consentText }}</p>
      </blockquote>
      <p>
        We keep that record so we can show, if asked, that you did ask to hear
        from us. Your address is also passed to
        <a
          href="https://www.mailerlite.com/legal/privacy-policy"
          rel="noopener"
        >
          MailerLite
        </a>
        , who send the emails on our behalf. MailerLite will email you to
        confirm before you receive anything — if you do not confirm, you are not
        subscribed.
      </p>
      <p>
        Every email we send carries an unsubscribe link, and unsubscribing takes
        effect immediately. You can also ask us to delete your consent record.
      </p>

      <h2>The contact form</h2>
      <p>
        Messages sent through the
        <a routerLink="/contact">contact form</a> are stored so we can reply,
        and are emailed to us. We do not use them for anything else.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask for a copy of what we hold about you, ask us to correct it,
        or ask us to delete it. Email
        <a href="mailto:info@fitoverforty.blog">info&#64;fitoverforty.blog</a>
        and we will respond within a month. If you are unhappy with how we have
        handled it, you can complain to the
        <a href="https://ico.org.uk/" rel="noopener">
          Information Commissioner's Office </a
        >.
      </p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPage {
  protected readonly consentText = CONSENT_TEXT;

  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.apply({
      title: 'Privacy',
      description:
        'What Fit Over Forty collects, why, and how to have it removed.',
      path: '/privacy',
    });
  }
}
