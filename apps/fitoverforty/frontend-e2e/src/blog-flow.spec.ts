import { expect, test, type Page } from '@playwright/test';

/**
 * The blog API is mocked rather than seeded.
 *
 * CI runs projects in parallel, so this suite cannot assume the backend e2e
 * migrations have already populated the database. Mocking also keeps the test
 * about rendering and navigation rather than about content.
 *
 * **A mock here only governs what the browser fetches.** Since #80 the HTTP
 * transfer cache works, so a server-rendered first load takes its data from
 * the server's own fetch and the browser never repeats the request — a
 * `page.goto` of a blog route shows whatever the real backend held. Routes
 * that fetch nothing (`/no/such/place`) are unaffected, and a post the backend
 * does not have 404s on the server, which is not cached, so the browser does
 * fetch it and the mock applies. Anything that needs the mock to decide what a
 * *listing* shows has to arrive by client-side navigation — see
 * `openArchive` — and anything that needs the API to fail on a first load
 * belongs in `ssr-e2e`, which owns the stub the server talks to.
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

/**
 * Reaches the archive by client-side navigation, from the one route that
 * fetches nothing at all — so the listing is drawn from the mock above rather
 * than from whatever the real backend holds.
 */
async function openArchive(page: Page): Promise<void> {
  await page.goto('/no/such/place');

  // Wait for hydration before clicking. Until then the link is a plain anchor
  // and clicking it is a full page load, which server-renders the archive
  // against the real backend and never asks the browser for anything.
  //
  // `withEventReplay()` stamps `jsaction` on every element it stashed a
  // listener for and removes it once that listener is Angular's, so its
  // absence is the exact moment this click starts routing instead of
  // navigating.
  const back = page.getByRole('link', { name: 'Back to the blog' });
  await expect(back).not.toHaveAttribute('jsaction');

  const listing = page.waitForResponse('**/api/blog/posts?*');
  await back.click();
  // Fails here, naming the request, if the click navigated instead of routing.
  await listing;
}

test('archive lists posts and links through to one', async ({ page }) => {
  await openArchive(page);

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

/**
 * §12 makes the post page the CTA's most important home: RSS ships item
 * descriptions rather than full bodies specifically so readers arrive here.
 *
 * It was missing from this page between #18 and #24 — the import was added and
 * the element was not. The only thing that noticed was an NG8113 compiler
 * warning, and warnings do not fail a build. This does.
 */
test('a post carries the newsletter CTA at its foot', async ({ page }) => {
  await page.goto('/blog/a-seeded-post');

  await expect(
    page.getByRole('heading', { name: 'Get new posts by email' }),
  ).toBeVisible();
});

test('an unknown post shows not-found rather than an error', async ({
  page,
}) => {
  await page.goto('/blog/missing');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Not found' }),
  ).toBeVisible();

  // Not under a 404. Asking for an email address as an apology for a page that
  // does not exist is the wrong moment, and this is the branch that decides it.
  await expect(
    page.getByRole('heading', { name: 'Get new posts by email' }),
  ).toHaveCount(0);
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
  //
  // Driven client-side: a mock cannot make the *server's* fetch fail, and the
  // first load is what the server rendered. The first-load half of this — and
  // the same claim about the home page, which nothing links to — is asserted
  // against a genuinely failing API in `ssr-e2e`.
  await page.route('**/api/blog/posts?*', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );

  await openArchive(page);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Blog' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('could not be loaded');
  await expect(page.locator('.blog-empty')).toHaveCount(0);
});
