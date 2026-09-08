/**
 * The routed pages, each reached by its own lazy `import()` from the app.
 *
 * Nothing imports this barrel: a dynamic import of it would pull all eight pages
 * into one chunk, and a static import would pull them into the initial bundle.
 * It exists so the project has a conventional entry point; the app routes
 * address the page modules directly by subpath.
 */
export { HomePage } from './lib/home.page';
export { BlogArchivePage } from './lib/blog-archive.page';
export { PillarIndexPage } from './lib/pillar-index.page';
export { PillarArchivePage } from './lib/pillar-archive.page';
export { TagIndexPage } from './lib/tag-index.page';
export { TagArchivePage } from './lib/tag-archive.page';
export { PostDetailPage } from './lib/post-detail.page';
export { NotFoundPage } from './lib/not-found.page';
