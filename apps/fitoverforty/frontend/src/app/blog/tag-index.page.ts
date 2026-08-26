import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { TagRef } from '@fitoverforty/content-model';
import type { Loaded } from './loaded';
import { LoadErrorComponent } from './load-error.component';

@Component({
  selector: 'app-tag-index-page',
  standalone: true,
  imports: [RouterLink, LoadErrorComponent],
  template: `
    <section class="anx-section blog-tag-index">
      <h1>Tags</h1>
      @if (tags(); as result) {
        @if (result.ok) {
          @if (result.data.length) {
            <ul class="blog-tag-list">
              @for (tag of result.data; track tag.slug) {
                <li>
                  <a [routerLink]="['/blog/tag', tag.slug]">{{ tag.name }}</a>
                </li>
              }
            </ul>
          } @else {
            <p class="blog-empty">No tags yet.</p>
          }
        } @else {
          <app-load-error />
        }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagIndexPage {
  readonly tags = input.required<Loaded<TagRef[]>>();
}
