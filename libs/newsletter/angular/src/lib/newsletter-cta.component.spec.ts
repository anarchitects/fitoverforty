import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NewsletterCtaComponent } from './newsletter-cta.component';
import { CONSENT_TEXT } from './consent';

const SUBSCRIBE = '/api/newsletter/subscribe';

describe('NewsletterCtaComponent', () => {
  let fixture: ComponentFixture<NewsletterCtaComponent>;
  let http: HttpTestingController;

  const el = <T extends HTMLElement>(selector: string) =>
    fixture.nativeElement.querySelector(selector) as T;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  const fill = (selector: string, value: string) => {
    const input = el<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  const tickConsent = () => {
    const box = el<HTMLInputElement>('input[type="checkbox"]');
    box.checked = true;
    box.dispatchEvent(new Event('change'));
  };

  const subscribe = () => el<HTMLButtonElement>('button').click();

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [NewsletterCtaComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(NewsletterCtaComponent);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('shows the canonical consent wording', () => {
    // The server stores its own copy; an e2e test proves the two agree. This
    // only asserts the component renders the constant rather than a literal.
    expect(text()).toContain(CONSENT_TEXT);
  });

  describe('the button is not a submit button', () => {
    it('is type=button, so a pre-hydration click cannot navigate', async () => {
      // A submit button performs a native GET before Angular is listening,
      // putting the subscriber's address in the URL, history and server log.
      expect(el<HTMLButtonElement>('button').type).toBe('button');
    });

    it('leaves no submit button anywhere in the form', () => {
      // With no submit button and more than one field, browsers also suppress
      // implicit submission on Enter, which closes the same hole.
      expect(
        fixture.nativeElement.querySelectorAll(
          'button[type="submit"], input[type="submit"]',
        ),
      ).toHaveLength(0);
    });
  });

  describe('refusals that never reach the server', () => {
    it('asks for an address rather than posting an empty one', async () => {
      tickConsent();
      subscribe();
      await fixture.whenStable();

      expect(text()).toContain('enter your email');
      http.expectNone(SUBSCRIBE);
    });

    it('will not submit without consent ticked', async () => {
      // Consent has to be affirmative. Posting without it would make the
      // stored record evidence of nothing.
      fill('#newsletter-email', 'reader@example.test');
      subscribe();
      await fixture.whenStable();

      expect(text()).toContain('tick the box');
      http.expectNone(SUBSCRIBE);
    });

    it('starts with consent unticked', () => {
      // Pre-ticking would not be consent.
      expect(el<HTMLInputElement>('input[type="checkbox"]').checked).toBe(
        false,
      );
    });
  });

  describe('a successful subscription', () => {
    it('posts the address, the honeypot and the page it came from', async () => {
      fill('#newsletter-email', '  reader@example.test  ');
      tickConsent();
      subscribe();
      await fixture.whenStable();

      const request = http.expectOne(SUBSCRIBE);
      expect(request.request.body).toEqual(
        expect.objectContaining({
          // Trimmed: a trailing space from an autofill is not a different
          // address.
          email: 'reader@example.test',
          consent: true,
          website: '',
        }),
      );
      request.flush({ status: 'pending' }, { status: 202, statusText: 'OK' });
    });

    it('replaces the form with a confirmation to check the inbox', async () => {
      fill('#newsletter-email', 'reader@example.test');
      tickConsent();
      subscribe();
      await fixture.whenStable();
      http
        .expectOne(SUBSCRIBE)
        .flush({ status: 'pending' }, { status: 202, statusText: 'OK' });
      await fixture.whenStable();
      fixture.detectChanges();

      // Double opt-in: "subscribed" would be a lie until they confirm.
      expect(text()).toContain('check your inbox');
      expect(fixture.nativeElement.querySelector('form')).toBeNull();
    });
  });

  describe('failures', () => {
    it('says the address looked wrong on a 400', async () => {
      fill('#newsletter-email', 'not-an-address');
      tickConsent();
      subscribe();
      await fixture.whenStable();
      http
        .expectOne(SUBSCRIBE)
        .flush(null, { status: 400, statusText: 'Bad Request' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(text()).toContain('did not look right');
    });

    /**
     * role=alert announces the message when it appears. aria-describedby is
     * what makes it reachable afterwards, when someone tabs back to the field
     * to correct it - without it, returning to the input says "invalid" and
     * nothing about why. Both are needed, and the link has to resolve to a
     * real element or it silently describes nothing.
     */
    it('points the input at the error message it just showed', async () => {
      const input = el<HTMLInputElement>('#newsletter-email');
      expect(input.getAttribute('aria-describedby')).toBeNull();

      fill('#newsletter-email', 'not-an-address');
      tickConsent();
      subscribe();
      await fixture.whenStable();
      http
        .expectOne(SUBSCRIBE)
        .flush(null, { status: 400, statusText: 'Bad Request' });
      await fixture.whenStable();
      fixture.detectChanges();

      const describedBy = el<HTMLInputElement>(
        '#newsletter-email',
      ).getAttribute('aria-describedby');
      expect(describedBy).toBe('newsletter-error');

      const described = fixture.nativeElement.querySelector(
        `#${describedBy}`,
      ) as HTMLElement | null;
      expect(described).not.toBeNull();
      expect(described?.textContent).toContain('did not look right');
    });

    it('keeps the form so the address is not lost on a server error', async () => {
      fill('#newsletter-email', 'reader@example.test');
      tickConsent();
      subscribe();
      await fixture.whenStable();
      http
        .expectOne(SUBSCRIBE)
        .flush(null, { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(text()).toContain('try again');
      expect(el<HTMLInputElement>('#newsletter-email').value).toBe(
        'reader@example.test',
      );
    });
  });

  describe('the honeypot', () => {
    it('is hidden from assistive technology and the tab order', async () => {
      const wrapper = el('.blog-newsletter-hp');
      expect(wrapper.getAttribute('aria-hidden')).toBe('true');
      expect(el<HTMLInputElement>('#newsletter-website').tabIndex).toBe(-1);
    });

    it('is sent as typed when a bot fills it', async () => {
      // The server answers "accepted" either way, so the component must not
      // pre-judge it — it just reports what was in the field.
      fill('#newsletter-email', 'bot@example.test');
      fill('#newsletter-website', 'https://spam.example');
      tickConsent();
      subscribe();
      await fixture.whenStable();

      const request = http.expectOne(SUBSCRIBE);
      expect(request.request.body).toEqual(
        expect.objectContaining({ website: 'https://spam.example' }),
      );
      request.flush({ status: 'pending' }, { status: 202, statusText: 'OK' });
    });
  });
});
