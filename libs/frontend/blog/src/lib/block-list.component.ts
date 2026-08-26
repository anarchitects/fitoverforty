import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
} from '@angular/core';
import type { ListItemData } from './block-types';

/**
 * Recursive so nested lists render at any depth.
 *
 * `content` is bound with [innerHTML] and therefore passes through Angular's
 * sanitizer. It was already allowlisted on write; this is the second layer,
 * and it is never bypassed.
 */
@Component({
  selector: 'fitoverforty-block-list',
  standalone: true,
  // A standalone component is not in scope inside its own template, so the
  // self-reference has to be imported through forwardRef to recurse.
  imports: [forwardRef(() => BlockListComponent)],
  template: `
    @if (ordered()) {
      <ol class="blog-list">
        @for (item of items(); track $index) {
          <li>
            <span [innerHTML]="item.content"></span>
            @if (item.items.length) {
              <fitoverforty-block-list
                [items]="item.items"
                [ordered]="ordered()"
              />
            }
          </li>
        }
      </ol>
    } @else {
      <ul class="blog-list">
        @for (item of items(); track $index) {
          <li>
            <span [innerHTML]="item.content"></span>
            @if (item.items.length) {
              <fitoverforty-block-list
                [items]="item.items"
                [ordered]="ordered()"
              />
            }
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockListComponent {
  readonly items = input.required<ListItemData[]>();
  readonly ordered = input.required<boolean>();
}
