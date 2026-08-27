/**
 * Asserts that the Nest process really server-renders the Angular app.
 *
 * This is the check community issue #501 identifies as missing: everything
 * else in CI passes just as happily when SSR silently degrades to shipping an
 * empty shell, and the only symptom is search rankings months later.
 *
 * The blog API is stubbed rather than seeded. CI runs projects in parallel, so
 * this cannot assume the backend e2e migrations have populated the database,
 * and stubbing also lets the failure path be exercised on demand.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';

const BACKEND = 'dist/apps/fitoverforty/backend/main.js';
const SERVER_ENTRY = 'dist/apps/fitoverforty/frontend/server/server.mjs';
const BROWSER_DIR = 'dist/apps/fitoverforty/frontend/browser';
const PORT = 3123;

const POST = {
  slug: 'ssr-check-post',
  title: 'Rendered on the server',
  description: 'Proof that SSR produced this.',
  publishedAt: '2026-08-01T09:00:00.000Z',
  authors: [{ id: '1', slug: 'paul', name: 'Paul' }],
  tags: [{ slug: 'strength', name: 'Strength' }],
  readingTimeMinutes: 3,
  hero: {
    src: '/assets/hero.png',
    alt: 'A lifter',
    width: 1200,
    height: 630,
  },
};

const failures = [];
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

/** Serves the blog API the server renderer will call. */
function startStubApi() {
  let failNext = false;
  const server = createServer((req, res) => {
    if (failNext) {
      res.writeHead(500, { 'content-type': 'application/json' });
      return res.end('{}');
    }
    const send = (body) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const paged = (items) => ({
      items,
      page: 1,
      perPage: 10,
      totalItems: items.length,
      totalPages: 1,
    });
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api/blog/posts') return send(paged([POST]));
    if (url.pathname === '/api/blog/tags') return send([POST.tags[0]]);
    if (url.pathname.startsWith('/api/blog/tags/')) return send(paged([POST]));
    if (url.pathname === `/api/blog/posts/${POST.slug}`) {
      return send({
        ...POST,
        body: {
          kind: 'blocks',
          blocks: {
            blocks: [
              { type: 'paragraph', data: { text: 'Server rendered body.' } },
              { type: 'header', data: { text: 'A section', level: 2 } },
            ],
          },
        },
        headings: [{ depth: 2, id: 'a-section', text: 'A section' }],
      });
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"statusCode":404}');
  });
  return {
    server,
    setFailing: (value) => {
      failNext = value;
    },
  };
}

async function waitFor(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const stub = startStubApi();
  stub.server.listen(0);
  await once(stub.server, 'listening');
  const stubPort = stub.server.address().port;

  // Drop any inherited PORT: it would override the one set below, which is
  // the collision documented in CLAUDE.md.
  const env = { ...process.env };
  delete env.PORT;
  const backend = spawn('node', [BACKEND], {
    env: {
      ...env,
      PORT: String(PORT),
      WEB_SERVER_ENTRY: SERVER_ENTRY,
      WEB_BROWSER_ASSETS_DIR: BROWSER_DIR,
      WEB_ALLOWED_HOSTS: 'localhost,127.0.0.1',
      SITE_URL: 'https://ssr-check.test',
      API_ORIGIN: `http://127.0.0.1:${stubPort}`,
      // The backend refuses to construct Better Auth without this, by design:
      // a default signing secret would make admin sessions forgeable. Nothing
      // here signs in, so the value only has to exist and be long enough.
      BETTER_AUTH_SECRET: 'ssr-check-only-secret-not-used-outside-this-harness',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let backendOutput = '';
  backend.stdout.on('data', (d) => (backendOutput += d));
  backend.stderr.on('data', (d) => (backendOutput += d));

  const base = `http://localhost:${PORT}`;
  try {
    await waitFor(`${base}/api`);

    console.log('server-rendered content');
    const postHtml = await (await fetch(`${base}/blog/${POST.slug}`)).text();
    check(
      'post title is in the HTML, not fetched by the browser',
      postHtml.includes(POST.title),
    );
    check(
      'block content is rendered',
      postHtml.includes('Server rendered body.'),
    );
    check('heading anchors are stamped', postHtml.includes('id="a-section"'));
    check(
      'document title is set',
      postHtml.includes(`<title>${POST.title} — Fit Over Forty</title>`),
    );

    console.log('hydration');
    check(
      'hydration markers present (server DOM is reused, not discarded)',
      postHtml.includes('ngh='),
    );
    check(
      'transfer state present (browser does not refetch)',
      postHtml.includes('ng-state'),
    );

    console.log('seo metadata');
    const head = postHtml.split('</head>')[0];
    check(
      'canonical points at the public origin',
      head.includes(
        `<link rel="canonical" href="https://ssr-check.test/blog/${POST.slug}">`,
      ),
    );
    check(
      'meta description is the post description',
      head.includes(`content="${POST.description}"`),
    );
    check(
      'OpenGraph type is article',
      head.includes('property="og:type" content="article"'),
    );
    check(
      'OpenGraph url is absolute',
      head.includes(`content="https://ssr-check.test/blog/${POST.slug}"`),
    );
    check(
      'hero image becomes og:image and a large twitter card',
      head.includes('https://ssr-check.test/assets/hero.png') &&
        head.includes('content="summary_large_image"'),
    );
    check('article tags are emitted', head.includes('property="article:tag"'));

    let jsonLd;
    try {
      const match = head.match(
        /<script id="blog-json-ld"[^>]*>([\s\S]*?)<\/script>/,
      );
      jsonLd = match ? JSON.parse(match[1]) : undefined;
    } catch {
      jsonLd = undefined;
    }
    check('JSON-LD is present and parses', Boolean(jsonLd));
    check('JSON-LD is a BlogPosting', jsonLd?.['@type'] === 'BlogPosting');
    check('JSON-LD headline matches the post', jsonLd?.headline === POST.title);
    check(
      'JSON-LD names the author',
      JSON.stringify(jsonLd?.author ?? []).includes('Paul'),
    );

    console.log('not-found metadata');
    const missingHead = (await (await fetch(`${base}/blog/nope`)).text()).split(
      '</head>',
    )[0];
    check(
      'a not-found page is noindex',
      missingHead.includes('name="robots"') && missingHead.includes('noindex'),
    );
    check(
      'and emits no canonical, which would point at a page that does not exist',
      !missingHead.includes('rel="canonical"'),
    );

    console.log('archive');
    const archiveHtml = await (await fetch(`${base}/blog`)).text();
    check(
      'archive lists the post server-side',
      archiveHtml.includes(POST.title),
    );

    console.log('status codes');
    check(
      'unknown post is 404, not 200',
      (await fetch(`${base}/blog/nope`)).status === 404,
    );
    check(
      'unmatched route is 404',
      (await fetch(`${base}/totally/made/up`)).status === 404,
    );
    check(
      'a real post is 200',
      (await fetch(`${base}/blog/${POST.slug}`)).status === 200,
    );

    console.log('degraded backend');
    stub.setFailing(true);
    const failed = await fetch(`${base}/blog`);
    check(
      'API failure renders 503, not an empty-looking 200',
      failed.status === 503,
    );
    check(
      'and says so in the body',
      (await failed.text()).includes('could not be loaded'),
    );
  } catch (error) {
    console.error('\nSSR check threw:', error);
    console.error('\n--- backend output ---\n', backendOutput.slice(-3000));
    failures.push('threw');
  } finally {
    backend.kill('SIGTERM');
    stub.server.close();
  }

  if (failures.length) {
    console.error(`\n${failures.length} SSR check(s) failed:`);
    for (const name of failures) console.error(`  - ${name}`);
    process.exit(1);
  }
  console.log('\nAll SSR checks passed.');
  process.exit(0);
}

main();
