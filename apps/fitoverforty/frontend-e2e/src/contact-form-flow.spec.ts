import { test, expect, type Page } from '@playwright/test';

/** The form's shape comes from the server; the tests mock it rather than the DB. */
const FORM_CONFIG = {
  id: 'contact-form',
  version: 1,
  fields: [
    {
      name: 'name',
      kind: 'string',
      required: true,
      ui: { label: 'Name', placeholder: 'Enter your name' },
    },
    {
      name: 'email',
      kind: 'email',
      required: true,
      ui: { label: 'Email', placeholder: 'Enter your email' },
    },
    {
      name: 'message',
      kind: 'textarea',
      required: true,
      ui: { label: 'Message', placeholder: 'Enter your message', rows: 5 },
    },
  ],
  security: { honeypot: 'website', captcha: 'none' },
};

const mockConfig = (page: Page) =>
  page.route('**/api/forms/contact-form*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ config: FORM_CONFIG }),
    }),
  );

test.describe('contact form flow', () => {
  test('submits the contact form successfully', async ({ page }) => {
    const expectedSubmission = {
      formId: 'contact-form',
      formVersion: 1,
      payload: {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        message: 'I would like to know more about your coaching programs.',
      },
    };

    let submissionRequestBody: unknown = null;

    await page.route('**/api/forms/contact-form*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: {
            id: 'contact-form',
            version: 1,
            fields: [
              {
                name: 'name',
                kind: 'string',
                required: true,
                ui: { label: 'Name', placeholder: 'Enter your name' },
              },
              {
                name: 'email',
                kind: 'email',
                required: true,
                ui: { label: 'Email', placeholder: 'Enter your email' },
              },
              {
                name: 'message',
                kind: 'textarea',
                required: true,
                ui: {
                  label: 'Message',
                  placeholder: 'Enter your message',
                  rows: 5,
                },
              },
            ],
            security: { honeypot: 'website', captcha: 'none' },
          },
        }),
      });
    });

    await page.route('**/api/forms/submit', async (route) => {
      submissionRequestBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'submission-1',
          createdAt: '2026-04-01T10:00:00.000Z',
          ...expectedSubmission,
        }),
      });
    });

    // '/' is the blog home now; the contact form has its own route since
    // the redirect that used to point here was removed.
    await page.goto('/contact');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Contact Us' }),
    ).toBeVisible();

    await page
      .getByPlaceholder('Enter your name')
      .fill(expectedSubmission.payload.name);
    await page
      .getByPlaceholder('Enter your email')
      .fill(expectedSubmission.payload.email);
    await page
      .getByPlaceholder('Enter your message')
      .fill(expectedSubmission.payload.message);

    await page.getByRole('button', { name: 'Submit' }).click();

    await expect.poll(() => submissionRequestBody).not.toBeNull();
    expect(submissionRequestBody).toEqual(expectedSubmission);
  });

  /**
   * The invalid state, which had never been looked at.
   *
   * Worth an e2e test rather than a unit one: the message, the `aria-invalid`
   * attribute and the styling that depends on it are produced by three
   * different layers - the forms package, Angular's validation, and this app's
   * CSS - and only a real browser has all three at once. Both of the styling
   * bugs this covers were invisible in the markup and only showed up in
   * computed styles.
   */
  test('shows an invalid email as an error, and marks the field', async ({
    page,
  }) => {
    await mockConfig(page);
    await page.goto('/contact');

    const email = page.getByPlaceholder('Enter your email');
    await email.fill('not-an-email');
    await email.blur();

    // Announced to assistive technology...
    await expect(email).toHaveAttribute('aria-invalid', 'true');

    // ...and visible, which is a separate question from being announced.
    const message = page.locator("[data-anx-slot='error']", {
      hasText: 'valid email',
    });
    await expect(message).toBeVisible();

    /**
     * The field itself has to change, not just the text below it. This asserts
     * the danger colour rather than "some border": the rule that sets it lost a
     * specificity fight with the base field rule on the first attempt, and the
     * page looked completely normal while the CSS was present and matching.
     */
    await expect(email).toHaveCSS('border-color', 'rgb(154, 64, 56)');

    // Colour is not the only signal - WCAG 1.4.1.
    const marker = await message.evaluate(
      (el) => getComputedStyle(el, '::before').content,
    );
    expect(marker).toContain('!');

    // Correcting it clears both the message and the marked state.
    await email.fill('reader@example.test');
    await email.blur();
    await expect(email).not.toHaveAttribute('aria-invalid', 'true');
    await expect(message).toBeHidden();
  });
});
