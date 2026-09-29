import {
  provideFormsDefaults,
  provideFormsPagePreset,
} from '@anarchitects/forms-angular/config';
import { Route } from '@angular/router';
import { IMAGE_UPLOADER } from '@fitoverforty/editorjs-angular';
import {
  adminGuard,
  HttpImageUploader,
  signedOutGuard,
} from '@fitoverforty/admin-angular-data-access';
import {
  archiveResolver,
  authorResolver,
  authorPostsResolver,
  latestResolver,
  pillarPostsResolver,
  pillarsResolver,
  postResolver,
  relatedResolver,
  tagPostsResolver,
  tagsResolver,
} from '@fitoverforty/blog-angular-data-access';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/home.page').then(
        (m) => m.HomePage,
      ),
    resolve: { latest: latestResolver },
    title: 'Fit Over Forty',
  },
  {
    path: 'blog',
    pathMatch: 'full',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/blog-archive.page').then(
        (m) => m.BlogArchivePage,
      ),
    resolve: { posts: archiveResolver },
    title: 'Blog — Fit Over Forty',
  },
  {
    path: 'blog/page/:page',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/blog-archive.page').then(
        (m) => m.BlogArchivePage,
      ),
    resolve: { posts: archiveResolver },
    title: 'Blog — Fit Over Forty',
  },
  // Must precede 'blog/:slug', which would otherwise match 'pillars' as a slug.
  {
    path: 'blog/pillars',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/pillar-index.page').then(
        (m) => m.PillarIndexPage,
      ),
    resolve: { pillars: pillarsResolver },
    title: 'Pillars — Fit Over Forty',
  },
  {
    path: 'blog/pillar/:pillar',
    pathMatch: 'full',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/pillar-archive.page').then(
        (m) => m.PillarArchivePage,
      ),
    resolve: { posts: pillarPostsResolver, pillars: pillarsResolver },
  },
  {
    path: 'blog/pillar/:pillar/page/:page',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/pillar-archive.page').then(
        (m) => m.PillarArchivePage,
      ),
    resolve: { posts: pillarPostsResolver, pillars: pillarsResolver },
  },
  /**
   * An author's posts. Both must precede 'blog/:slug' for the same reason the
   * tag routes do — otherwise 'author' is matched as a post slug.
   *
   * The route parameter is named `slug` so component input binding hands it to
   * the page's `slug` input; `author` is taken by the resolved profile.
   */
  {
    path: 'blog/author/:slug',
    pathMatch: 'full',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/author-archive.page').then(
        (m) => m.AuthorArchivePage,
      ),
    resolve: { author: authorResolver, posts: authorPostsResolver },
  },
  {
    path: 'blog/author/:slug/page/:page',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/author-archive.page').then(
        (m) => m.AuthorArchivePage,
      ),
    resolve: { author: authorResolver, posts: authorPostsResolver },
  },
  // Must precede 'blog/:slug', which would otherwise match 'tags' as a slug.
  {
    path: 'blog/tags',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/tag-index.page').then(
        (m) => m.TagIndexPage,
      ),
    resolve: { tags: tagsResolver },
    title: 'Tags — Fit Over Forty',
  },
  {
    path: 'blog/tag/:tag',
    pathMatch: 'full',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/tag-archive.page').then(
        (m) => m.TagArchivePage,
      ),
    resolve: { posts: tagPostsResolver },
  },
  {
    path: 'blog/tag/:tag/page/:page',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/tag-archive.page').then(
        (m) => m.TagArchivePage,
      ),
    resolve: { posts: tagPostsResolver },
  },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/post-detail.page').then(
        (m) => m.PostDetailPage,
      ),
    resolve: { post: postResolver, related: relatedResolver },
  },
  /**
   * The admin area. Nothing here is server-rendered — see app.routes.server.ts
   * — and every child sits behind `adminGuard`.
   *
   * `sign-in` is a sibling of the shell rather than a child of it, so that the
   * sign-in page does not render inside a frame carrying a sign-out button and
   * the name of nobody.
   */
  {
    path: 'admin/sign-in',
    canActivate: [signedOutGuard],
    loadComponent: () =>
      import('@fitoverforty/admin-angular-feature/sign-in.page').then(
        (m) => m.SignInPage,
      ),
    title: 'Sign in — Fit Over Forty',
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    /**
     * The editor library ships an uploader that refuses everything, so that a
     * missing binding fails loudly rather than dropping files. This is where
     * the app supplies the real one — scoped to the admin routes, since
     * nothing else mounts an editor.
     */
    providers: [{ provide: IMAGE_UPLOADER, useExisting: HttpImageUploader }],
    loadComponent: () =>
      import('@fitoverforty/admin-angular-feature/admin-shell.page').then(
        (m) => m.AdminShellPage,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('@fitoverforty/admin-angular-feature/dashboard.page').then(
            (m) => m.DashboardPage,
          ),
        title: 'Posts — Fit Over Forty',
      },
      /**
       * `new` before `:id`, or it would be read as a post id and the editor
       * would ask the API for a post called "new".
       */
      {
        path: 'posts/new',
        loadComponent: () =>
          import('@fitoverforty/admin-angular-feature/post-editor.page').then(
            (m) => m.PostEditorPage,
          ),
        title: 'New post — Fit Over Forty',
      },
      {
        path: 'posts/:id',
        loadComponent: () =>
          import('@fitoverforty/admin-angular-feature/post-editor.page').then(
            (m) => m.PostEditorPage,
          ),
        title: 'Edit post — Fit Over Forty',
      },
    ],
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('@fitoverforty/legal-angular').then((m) => m.PrivacyPage),
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('@anarchitects/forms-angular').then(
        (m) => m.AnarchitectsFeatureForm,
      ),
    providers: [
      provideFormsDefaults(),
      provideFormsPagePreset({
        layoutVariant: 'stacked',
        maxInlineSize: '44rem',
        spacing: 'compact',
        actionAlignment: 'start',
      }),
    ],
    data: {
      formId: 'contact-form',
      formVersion: 1,
      pageTitle: 'Contact Us',
      pageCaption:
        'We would love to hear from you! Please fill out the form below to get in touch with us.',
    },
  },
  {
    path: '**',
    loadComponent: () =>
      import('@fitoverforty/blog-angular-feature/not-found.page').then(
        (m) => m.NotFoundPage,
      ),
    title: 'Not found — Fit Over Forty',
  },
];
