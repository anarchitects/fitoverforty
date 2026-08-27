import { expect, test } from '@playwright/test';

/**
 * The admin area, from the outside.
 *
 * These tests deliberately never sign in. Doing so would need a seeded account
 * with a known password, and a CI database that ships with working admin
 * credentials is a worse thing to own than a gap in coverage. What is left is
 * still the part most likely to break silently: the guard, and the fact that a
 * real browser's sign-in POST reaches Better Auth at all.
 *
 * Signed-in behaviour is covered by the Angular unit tests, which drive
 * AuthService against a mocked backend.
 */

async function openSignIn(page: import('@playwright/test').Page, path: string) {
  await page.goto(path);
  // Client-rendered, so wait for the form rather than the navigation.
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('admin authentication', () => {
  test('an unauthenticated visitor is sent to sign-in', async ({ page }) => {
    await openSignIn(page, '/admin');
    await expect(page).toHaveURL(/\/admin\/sign-in/);
  });

  test('the requested page is remembered for after sign-in', async ({
    page,
  }) => {
    await openSignIn(page, '/admin');
    expect(new URL(page.url()).searchParams.get('returnUrl')).toBe('/admin');
  });

  test('the admin area is not indexable', async ({ page }) => {
    // robots.txt disallows /admin, but a crawler that arrives without reading
    // it first should still be told.
    await openSignIn(page, '/admin/sign-in');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });

  /**
   * The reason this file exists.
   *
   * Better Auth rejects state-changing requests whose Origin it does not
   * trust, with a 403 that looks nothing like a credentials problem. `curl`
   * sends no Origin at all and is refused, so only a real browser proves the
   * app's own sign-in request is accepted. A 401 here means the request got
   * as far as checking the password, which is the whole point.
   */
  test('a real browser sign-in reaches the credential check', async ({
    page,
  }) => {
    await openSignIn(page, '/admin/sign-in');

    const response = page.waitForResponse(
      (r) =>
        r.url().includes('/api/auth/sign-in/email') &&
        r.request().method() === 'POST',
    );

    await page.getByLabel('Email address').fill('nobody@example.invalid');
    await page.getByLabel('Password').fill('not-the-right-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    expect((await response).status()).toBe(401);
    await expect(page.getByRole('alert')).toContainText('do not match');
  });

  test('failure does not say whether the account exists', async ({ page }) => {
    await openSignIn(page, '/admin/sign-in');

    await page.getByLabel('Email address').fill('nobody@example.invalid');
    await page.getByLabel('Password').fill('not-the-right-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    const message = await page.getByRole('alert').textContent();
    expect(message).not.toMatch(/no such|not found|unknown|does not exist/i);
  });

  test('the credentials never reach the URL', async ({ page }) => {
    // The same hazard the newsletter form has: a native submit before the
    // listener is attached would put the password in the address bar, the
    // browser history and the server log.
    await openSignIn(page, '/admin/sign-in');

    await page.getByLabel('Email address').fill('nobody@example.invalid');
    await page.getByLabel('Password').fill('not-the-right-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    expect(page.url()).not.toContain('not-the-right-password');
    expect(page.url()).not.toContain('nobody%40example.invalid');
  });

  test('there is no public sign-up route', async ({ page }) => {
    /**
     * The page is opened first purely to have a real origin to send.
     *
     * Better Auth refuses a state-changing request with a null Origin before
     * it looks at anything else, so posting from `about:blank` returns 403
     * MISSING_OR_NULL_ORIGIN — which would pass a naive "not 200" assertion
     * while proving nothing about whether sign-up is disabled.
     */
    await openSignIn(page, '/admin/sign-in');
    const origin = new URL(page.url()).origin;

    const response = await page.request.post(
      `${origin}/api/auth/sign-up/email`,
      {
        data: {
          email: 'intruder@example.invalid',
          name: 'Intruder',
          password: 'Intruder-Password-2026',
        },
        headers: { origin },
      },
    );

    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('SIGN_UP_DISABLED');
  });
});
