import {
  provideFormsDefaults,
  provideFormsPagePreset,
} from '@anarchitects/forms-angular/config';
import { Route } from '@angular/router';
import { adminGuard, signedOutGuard } from './admin/admin.guard';
import {
  archiveResolver,
  latestResolver,
  postResolver,
  tagPostsResolver,
  tagsResolver,
} from './blog/blog.resolvers';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./blog/home.page').then((m) => m.HomePage),
    resolve: { latest: latestResolver },
    title: 'Fit Over Forty',
  },
  {
    path: 'blog',
    pathMatch: 'full',
    loadComponent: () =>
      import('./blog/blog-archive.page').then((m) => m.BlogArchivePage),
    resolve: { posts: archiveResolver },
    title: 'Blog — Fit Over Forty',
  },
  {
    path: 'blog/page/:page',
    loadComponent: () =>
      import('./blog/blog-archive.page').then((m) => m.BlogArchivePage),
    resolve: { posts: archiveResolver },
    title: 'Blog — Fit Over Forty',
  },
  // Must precede 'blog/:slug', which would otherwise match 'tags' as a slug.
  {
    path: 'blog/tags',
    loadComponent: () =>
      import('./blog/tag-index.page').then((m) => m.TagIndexPage),
    resolve: { tags: tagsResolver },
    title: 'Tags — Fit Over Forty',
  },
  {
    path: 'blog/tag/:tag',
    pathMatch: 'full',
    loadComponent: () =>
      import('./blog/tag-archive.page').then((m) => m.TagArchivePage),
    resolve: { posts: tagPostsResolver },
  },
  {
    path: 'blog/tag/:tag/page/:page',
    loadComponent: () =>
      import('./blog/tag-archive.page').then((m) => m.TagArchivePage),
    resolve: { posts: tagPostsResolver },
  },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('./blog/post-detail.page').then((m) => m.PostDetailPage),
    resolve: { post: postResolver },
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
      import('./admin/sign-in.page').then((m) => m.SignInPage),
    title: 'Sign in — Fit Over Forty',
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin/admin-shell.page').then((m) => m.AdminShellPage),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./admin/dashboard.page').then((m) => m.DashboardPage),
        title: 'Dashboard — Fit Over Forty',
      },
    ],
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./legal/privacy.page').then((m) => m.PrivacyPage),
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
      import('./blog/not-found.page').then((m) => m.NotFoundPage),
    title: 'Not found — Fit Over Forty',
  },
];
