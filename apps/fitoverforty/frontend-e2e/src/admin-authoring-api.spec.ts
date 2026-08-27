import { expect, test } from '@playwright/test';

/**
 * The authoring API and its routes, against the real built server.
 *
 * Like `admin-auth-flow.spec.ts`, these never sign in: a CI database shipping
 * working admin credentials is a worse thing to own than a gap in coverage.
 * What that leaves is still the half most likely to fail silently — that the
 * guard is actually mounted on the real Nest process, and that the editor
 * routes are behind it.
 *
 * The other half — what the API does once a session exists — is
 * `fitoverforty-backend-e2e`'s `publish-workflow.spec.ts`, which fakes the
 * session and exercises every write against a real database. Neither suite is
 * sufficient alone, and saying so is cheaper than a third one that pretends
 * to be.
 */

const SOME_UUID = '00000000-0000-4000-8000-000000000000';

test.describe('the authoring API', () => {
  /**
   * `page.request` rather than `fetch`: it sends a real Origin, and Better
   * Auth refuses an unrecognised one before it looks at the session at all.
   * That refusal is a 403 and would pass a naive "not 200" assertion while
   * proving nothing about the guard.
   */
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  const cases: [string, string][] = [
    ['GET', '/api/admin/posts'],
    ['POST', '/api/admin/posts'],
    ['PATCH', `/api/admin/posts/${SOME_UUID}`],
    ['POST', `/api/admin/posts/${SOME_UUID}/publish`],
    ['POST', `/api/admin/posts/${SOME_UUID}/unpublish`],
    ['POST', '/api/media'],
  ];

  for (const [method, path] of cases) {
    test(`answers 401 to an unauthenticated ${method} ${path}`, async ({
      page,
    }) => {
      const origin = new URL(page.url()).origin;
      const response = await page.request.fetch(`${origin}${path}`, {
        method,
        headers: { origin },
        ...(method === 'GET' ? {} : { data: {} }),
      });

      // 401 specifically. A 403 would mean Better Auth rejected the origin
      // before the guard ran, and a 500 would mean the guard threw — both
      // would hide a route that is not actually protected.
      expect(response.status()).toBe(401);
    });
  }

  test('drafts never leak through the public read API', async ({ page }) => {
    // The admin list and the public list read the same table. This is the
    // assertion that they do not read it the same way.
    const origin = new URL(page.url()).origin;
    const response = await page.request.get(
      `${origin}/api/blog/posts?perPage=50`,
    );

    const body = (await response.json()) as {
      items: { slug: string; publishedAt: string }[];
    };
    const now = Date.now();
    for (const item of body.items) {
      expect(new Date(item.publishedAt).getTime()).toBeLessThanOrEqual(now);
    }
  });
});

test.describe('the editor routes', () => {
  for (const path of ['/admin/posts/new', `/admin/posts/${SOME_UUID}`]) {
    test(`${path} sends an unauthenticated visitor to sign-in`, async ({
      page,
    }) => {
      await page.goto(path);
      // Client-rendered, so wait for the form rather than the navigation.
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({
        timeout: 15_000,
      });
      expect(new URL(page.url()).searchParams.get('returnUrl')).toBe(path);
    });
  }
});
