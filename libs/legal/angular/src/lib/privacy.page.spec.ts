import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CONSENT_TEXT } from '@fitoverforty/newsletter-angular';
import { PrivacyPage } from './privacy.page';
import { FIT_OVER_FORTY } from '@fitoverforty/site-ts';
import { provideSiteIdentity } from '@fitoverforty/site-angular';

/**
 * This page is a legal obligation, not decoration.
 *
 * Spec §12: consent has to be affirmative, separate, and linked to a privacy
 * policy — which makes the policy a v1 requirement rather than a nicety. These
 * tests assert the disclosures UK GDPR/PECR actually require are present, so
 * that a tidy-up of the copy cannot quietly delete one.
 */
describe('PrivacyPage', () => {
  let fixture: ComponentFixture<PrivacyPage>;
  const text = () =>
    (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ??
    '';
  const links = () =>
    [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
        'a[href]',
      ),
    ].map((a) => a.getAttribute('href'));

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PrivacyPage],
      providers: [provideRouter([]), provideSiteIdentity(FIT_OVER_FORTY)],
    });
    fixture = TestBed.createComponent(PrivacyPage);
    await fixture.whenStable();
  });

  it('shows the exact consent wording that gets stored', () => {
    // Rendered from the shared constant, not retyped: the page has to quote
    // what the record actually says, or it is evidence of something else.
    expect(text()).toContain(CONSENT_TEXT);
  });

  it('names what is collected on subscribing', () => {
    for (const item of ['email address', 'date and time', 'IP address']) {
      expect(text()).toContain(item);
    }
  });

  it('names the processor and links to its policy', () => {
    // A third party receiving personal data has to be disclosed by name.
    expect(text()).toContain('MailerLite');
    expect(links()).toContain('https://www.mailerlite.com/legal/privacy-policy');
  });

  it('states that subscribing needs confirming', () => {
    // Double opt-in is the lawful basis here; the page has to say so.
    expect(text()).toContain('confirm');
    expect(text()).toContain('not subscribed');
  });

  it('explains unsubscribing and deletion of the record', () => {
    expect(text()).toContain('unsubscribe');
    expect(text()).toContain('delete your consent record');
  });

  it('gives a contact route for a subject access request, and a deadline', () => {
    expect(links()).toContain('mailto:info@fitoverforty.blog');
    expect(text()).toContain('within a month');
  });

  it('names the supervisory authority people can complain to', () => {
    expect(text()).toContain("Information Commissioner's Office");
    expect(links()).toContain('https://ico.org.uk/');
  });

  it('opens external links without handing over the referrer window', () => {
    const external = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
        'a[href^="http"]',
      ),
    ];
    expect(external.length).toBeGreaterThan(0);
    for (const link of external) {
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });
});
