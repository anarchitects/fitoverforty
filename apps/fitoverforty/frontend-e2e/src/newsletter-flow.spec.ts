import { expect, test } from '@playwright/test';

const SUBSCRIBE = '**/api/newsletter/subscribe';

/**
 * Opens a page and waits until the form actually responds.
 *
 * The app is server-rendered, so the markup exists — and Playwright will
 * happily click it — well before Angular has attached any listeners. Clicking
 * the empty form is a harmless probe: it mutates nothing, and the validation
 * message only appears once the component is live.
 *
 * Production output carries Angular's event-replay attributes, so a real early
 * click is replayed rather than lost; the dev server these tests run against
 * does not, which is why the wait is needed here.
 */
async function openInteractive(
  page: import('@playwright/test').Page,
  path: string,
) {
  await page.goto(path);

  await expect(async () => {
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByRole('alert')).toContainText('enter your email');
  }).toPass({ timeout: 15_000 });
}

test.describe('newsletter signup', () => {
  test('will not submit without the consent box ticked', async ({ page }) => {
    let called = false;
    await page.route(SUBSCRIBE, (route) => {
      called = true;
      return route.fulfill({ status: 202, body: '{"status":"pending"}' });
    });

    await openInteractive(page, '/blog');
    await page.getByLabel('Email address').fill('reader@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();

    await expect(page.getByRole('alert')).toContainText('tick the box');
    expect(called).toBe(false);
  });

  test('sends consent and shows the confirm-your-inbox message', async ({
    page,
  }) => {
    let payload: Record<string, unknown> | undefined;
    await page.route(SUBSCRIBE, async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({ status: 202, body: '{"status":"pending"}' });
    });

    await openInteractive(page, '/blog');
    await page.getByLabel('Email address').fill('reader@example.com');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Subscribe' }).click();

    await expect(page.getByRole('status')).toContainText('check your inbox');
    expect(payload).toMatchObject({
      email: 'reader@example.com',
      consent: true,
      website: '',
    });
  });

  test('the consent checkbox starts unticked', async ({ page }) => {
    // Pre-ticking would not be consent.
    await openInteractive(page, '/blog');
    await expect(page.getByRole('checkbox')).not.toBeChecked();
  });

  test('the honeypot is hidden from people and from assistive technology', async ({
    page,
  }) => {
    await openInteractive(page, '/blog');
    const honeypot = page.locator('#newsletter-website');
    await expect(honeypot).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('.blog-newsletter-hp')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    // It must also not be visible, or people fill it in and get silently dropped.
    await expect(honeypot).not.toBeInViewport();
  });

  test('never puts the address in the URL, even before hydration', async ({
    page,
  }) => {
    // A submit button would perform a native GET before Angular attaches its
    // listener, navigating to ?email=... and leaking the address into history
    // and server logs.
    await page.route(SUBSCRIBE, (route) =>
      route.fulfill({ status: 202, body: '{"status":"pending"}' }),
    );

    await openInteractive(page, '/blog');
    await page.getByLabel('Email address').fill('reader@example.com');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Subscribe' }).click();

    await expect(page.getByRole('status')).toContainText('check your inbox');
    expect(page.url()).not.toContain('email=');
    expect(page.url()).not.toContain('reader%40example.com');
  });

  test('the wording shown matches what the server records', async ({
    page,
    request,
  }) => {
    // The two constants are separate so that rendering a checkbox does not
    // cost a request. This is what stops them drifting apart.
    await openInteractive(page, '/blog');
    const shown = (
      await page.locator('.blog-newsletter-consent span').innerText()
    ).trim();

    const canonical = await (
      await request.get('/api/newsletter/consent')
    ).json();

    expect(shown).toBe(canonical.text);
  });

  test('links to the privacy policy, which explains the record', async ({
    page,
  }) => {
    await openInteractive(page, '/blog');
    await page.getByRole('link', { name: 'How we handle your data' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Privacy' }),
    ).toBeVisible();
    await expect(page.locator('body')).toContainText('MailerLite');
    await expect(page.locator('body')).toContainText('unsubscribe');
  });
});
