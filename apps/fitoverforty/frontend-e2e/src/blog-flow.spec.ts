import { expect, test } from '@playwright/test';

/**
 * The blog API is mocked rather than seeded.
 *
 * CI runs projects in parallel, so this suite cannot assume the backend e2e
 * migrations have already populated the database. Mocking also keeps the test
 * about rendering and navigation rather than about content.
 */
const POST_SUMMARY = {
  slug: 'a-seeded-post',
  title: 'A seeded post',
  description: 'Something worth reading.',
  publishedAt: '2026-08-01T09:00:00.000Z',
  authors: [{ id: '1', slug: 'paul', name: 'Paul' }],
  tags: [{ slug: 'strength', name: 'Strength' }],
  readingTimeMinutes: 4,
};

const paged = (items: unknown[]) => ({
  items,
  page: 1,
  perPage: 10,
  totalItems: items.length,
  totalPages: 1,
});

const POST = {
  ...POST_SUMMARY,
  body: {
    kind: 'blocks',
    blocks: {
      blocks: [
        { type: 'paragraph', data: { text: 'A <b>bold</b> opening.' } },
        { type: 'header', data: { text: 'The middle', level: 2 } },
        {
          type: 'list',
          data: { style: 'unordered', items: ['first', 'second'] },
        },
        { type: 'code', data: { code: 'if (a < b) return "<script>";' } },
      ],
    },
  },
  headings: [{ depth: 2, id: 'the-middle', text: 'The middle' }],
};

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

test.beforeEach(async ({ page }) => {
  await page.route('**/api/blog/posts?*', (route) =>
    route.fulfill(json(paged([POST_SUMMARY]))),
  );
  await page.route('**/api/blog/tags', (route) =>
    route.fulfill(json([{ slug: 'strength', name: 'Strength' }])),
  );
  await page.route('**/api/blog/tags/*/posts?*', (route) =>
    route.fulfill(json(paged([POST_SUMMARY]))),
  );
  await page.route('**/api/blog/posts/a-seeded-post', (route) =>
    route.fulfill(json(POST)),
  );
  await page.route('**/api/blog/posts/missing', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 404, message: 'Not found' }),
    }),
  );
});

test('archive lists posts and links through to one', async ({ page }) => {
  await page.goto('/blog');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Blog' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'A seeded post' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'A seeded post' }),
  ).toBeVisible();
  await expect(page).toHaveTitle('A seeded post — Fit Over Forty');
});

test('renders blocks as semantic markup', async ({ page }) => {
  await page.goto('/blog/a-seeded-post');

  await expect(page.locator('p.blog-paragraph b')).toHaveText('bold');
  await expect(page.locator('h2#the-middle')).toHaveText('The middle');
  await expect(page.locator('ul.blog-list li')).toHaveCount(2);
});

test('renders code as text, not markup', async ({ page }) => {
  await page.goto('/blog/a-seeded-post');

  const code = page.locator('pre.blog-code code');
  await expect(code).toHaveText('if (a < b) return "<script>";');
  await expect(page.locator('pre.blog-code script')).toHaveCount(0);
});

test('an unknown post shows not-found rather than an error', async ({
  page,
}) => {
  await page.goto('/blog/missing');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Not found' }),
  ).toBeVisible();
});

test('a route that matches nothing shows not-found', async ({ page }) => {
  await page.goto('/no/such/place');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Not found' }),
  ).toBeVisible();
});

test('tag archive is reachable from a post', async ({ page }) => {
  await page.goto('/blog/a-seeded-post');
  await page.getByRole('link', { name: 'Strength' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Tagged “strength”' }),
  ).toBeVisible();
});

test('an API failure shows an error, not a blank page or a false empty state', async ({
  page,
}) => {
  // A rejecting resolver cancels the navigation and leaves the browser on a
  // blank page, so resolvers swallow failures and the page renders them. It
  // must not look like "no posts yet" either.
  await page.route('**/api/blog/posts?*', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );

  await page.goto('/blog');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Blog' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('could not be loaded');
  await expect(page.locator('.blog-empty')).toHaveCount(0);
});

test('the home page still renders when the API is down', async ({ page }) => {
  await page.route('**/api/blog/posts?*', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );

  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Fit Over Forty' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toBeVisible();
});
