/**
 * The admin pages, each reached by its own lazy `import()` from the app.
 *
 * As with the blog's feature project, nothing imports this barrel — the routes
 * address the page modules directly by subpath, so each keeps its own chunk
 * and none of it reaches a reader who never signs in.
 */
export { SignInPage } from './lib/sign-in.page';
export { AdminShellPage } from './lib/admin-shell.page';
export { DashboardPage } from './lib/dashboard.page';
export { PostEditorPage } from './lib/post-editor.page';
