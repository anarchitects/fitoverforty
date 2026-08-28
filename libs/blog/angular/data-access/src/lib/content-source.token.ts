import { InjectionToken } from '@angular/core';
import type { ContentSource } from '@fitoverforty/blog-ts';

/** Pages depend on the port, never on the HTTP implementation. */
export const CONTENT_SOURCE = new InjectionToken<ContentSource>(
  'CONTENT_SOURCE',
);
