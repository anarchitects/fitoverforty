import { test, expect } from '@playwright/test';

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

    await page.goto('/');

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
});
