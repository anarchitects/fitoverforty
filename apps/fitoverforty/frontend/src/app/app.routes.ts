import {
  provideFormsDefaults,
  provideFormsPagePreset,
} from '@anarchitects/forms-angular/config';
import { Route } from '@angular/router';
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
