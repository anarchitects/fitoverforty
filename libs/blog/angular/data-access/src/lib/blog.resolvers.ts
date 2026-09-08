import { inject } from '@angular/core';
import type { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import type {
  Paged,
  PillarSummary,
  Post,
  PostSummary,
  TagSummary,
} from '@fitoverforty/blog-ts';
import { CONTENT_SOURCE } from './content-source.token';
import { loaded, type Loaded } from './loaded';

/** Spec §16: a guess, cheap to change before launch. */
export const POSTS_PER_PAGE = 10;
const LATEST_ON_HOME = 6;

function pageParam(route: ActivatedRouteSnapshot): number {
  const raw = route.paramMap.get('page');
  if (!raw) return 1;
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/**
 * Data is resolved rather than fetched in the component so that server-side
 * rendering waits for it. A component that fetches after it renders produces
 * an empty shell in the HTML, which defeats the point of rendering at all.
 */
export const archiveResolver: ResolveFn<Loaded<Paged<PostSummary>>> = (route) =>
  loaded(inject(CONTENT_SOURCE).listPosts(pageParam(route), POSTS_PER_PAGE));

export const latestResolver: ResolveFn<Loaded<Paged<PostSummary>>> = () =>
  loaded(inject(CONTENT_SOURCE).listPosts(1, LATEST_ON_HOME));

export const tagsResolver: ResolveFn<Loaded<TagSummary[]>> = () =>
  loaded(inject(CONTENT_SOURCE).listTags());

export const tagPostsResolver: ResolveFn<Loaded<Paged<PostSummary>>> = (
  route,
) =>
  loaded(
    inject(CONTENT_SOURCE).postsByTag(
      route.paramMap.get('tag') ?? '',
      pageParam(route),
      POSTS_PER_PAGE,
    ),
  );

export const pillarsResolver: ResolveFn<Loaded<PillarSummary[]>> = () =>
  loaded(inject(CONTENT_SOURCE).listPillars());

export const pillarPostsResolver: ResolveFn<Loaded<Paged<PostSummary>>> = (
  route,
) =>
  loaded(
    inject(CONTENT_SOURCE).postsByPillar(
      route.paramMap.get('pillar') ?? '',
      pageParam(route),
      POSTS_PER_PAGE,
    ),
  );

/** `data: undefined` is a genuine 404; `ok: false` is a failure to reach the API. */
export const postResolver: ResolveFn<Loaded<Post | undefined>> = (route) =>
  loaded(inject(CONTENT_SOURCE).loadPost(route.paramMap.get('slug') ?? ''));
