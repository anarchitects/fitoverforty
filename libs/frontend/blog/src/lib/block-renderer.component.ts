import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  headingIdsByBlockIndex,
  type OutputBlockData,
  type OutputData,
} from '@fitoverforty/content-model';
import { BlockListComponent } from './block-list.component';
import {
  dataOf,
  normaliseItems,
  type CodeData,
  type HeaderData,
  type ImageData,
  type ListData,
  type ParagraphData,
  type QuoteData,
  type TableData,
} from './block-types';

/**
 * Renders stored Editor.js blocks as semantic HTML.
 *
 * Two rules hold this together:
 *
 * 1. Text-bearing fields are bound with [innerHTML] and pass through Angular's
 *    sanitizer. The content was already allowlisted server-side on write; this
 *    is the second layer and it is never bypassed.
 *
 * 2. Code is bound as text, never as HTML. The backend deliberately stores it
 *    unsanitised because it is plain text, so interpolating it is what keeps
 *    that safe. Changing this to [innerHTML] would be a stored-XSS hole.
 *
 * Styling is deliberately absent (spec §11) — class hooks only, semantics
 * first, so the Tailwind-or-tokens decision lands in one later pass.
 */
@Component({
  selector: 'fitoverforty-block-renderer',
  standalone: true,
  imports: [BlockListComponent],
  template: `
    @for (block of blocks().blocks; track block.id ?? $index) {
      @switch (block.type) {
        @case ('paragraph') {
          <p class="blog-paragraph" [innerHTML]="paragraph(block).text"></p>
        }
        @case ('header') {
          @if (header(block).level === 2) {
            <h2
              class="blog-heading"
              [id]="headingId($index)"
              [innerHTML]="header(block).text"
            ></h2>
          } @else {
            <h3
              class="blog-heading"
              [id]="headingId($index)"
              [innerHTML]="header(block).text"
            ></h3>
          }
        }
        @case ('list') {
          <fitoverforty-block-list
            [items]="listItems(block)"
            [ordered]="list(block).style === 'ordered'"
          />
        }
        @case ('quote') {
          <figure class="blog-quote">
            <blockquote [innerHTML]="quote(block).text"></blockquote>
            @if (quote(block).caption) {
              <figcaption [innerHTML]="quote(block).caption"></figcaption>
            }
          </figure>
        }
        @case ('image') {
          <figure class="blog-figure">
            <img
              [src]="image(block).file.url"
              [alt]="image(block).caption ?? ''"
              loading="lazy"
              decoding="async"
            />
            @if (image(block).caption) {
              <figcaption [innerHTML]="image(block).caption"></figcaption>
            }
          </figure>
        }
        @case ('code') {
          <!-- Text interpolation, never innerHTML. See the class comment. -->
          <pre class="blog-code"><code>{{ code(block).code }}</code></pre>
        }
        @case ('delimiter') {
          <hr class="blog-delimiter" />
        }
        @case ('table') {
          <div class="blog-table-scroll">
            <table class="blog-table">
              @if (table(block).withHeadings && table(block).content.length) {
                <thead>
                  <tr>
                    @for (cell of table(block).content[0]; track $index) {
                      <th [innerHTML]="cell"></th>
                    }
                  </tr>
                </thead>
              }
              <tbody>
                @for (row of bodyRows(block); track $index) {
                  <tr>
                    @for (cell of row; track $index) {
                      <td [innerHTML]="cell"></td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @default {
          <!--
            A block type the backend accepts but this renderer does not know.
            Silent in production so a reader never sees scaffolding; visible in
            development so it is caught before it ships.
          -->
          @if (showUnknown()) {
            <p class="blog-unknown-block">
              Unrenderable block of type "{{ block.type }}".
            </p>
          }
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockRendererComponent {
  readonly blocks = input.required<OutputData>();
  /** Set by the host app from its environment. */
  readonly showUnknown = input(false);

  protected paragraph = (block: OutputBlockData) =>
    dataOf<ParagraphData>(block);
  protected header = (block: OutputBlockData) => dataOf<HeaderData>(block);
  protected list = (block: OutputBlockData) => dataOf<ListData>(block);
  protected quote = (block: OutputBlockData) => dataOf<QuoteData>(block);
  protected image = (block: OutputBlockData) => dataOf<ImageData>(block);
  protected code = (block: OutputBlockData) => dataOf<CodeData>(block);
  protected table = (block: OutputBlockData) => dataOf<TableData>(block);

  protected listItems(block: OutputBlockData) {
    return normaliseItems(this.list(block).items);
  }

  protected bodyRows(block: OutputBlockData): string[][] {
    const { withHeadings, content } = this.table(block);
    return withHeadings ? content.slice(1) : content;
  }

  /**
   * Ids come from the same function the API uses to build Post.headings, so a
   * table of contents cannot link to an anchor that does not exist.
   */
  private readonly headingIds = computed(() =>
    headingIdsByBlockIndex(this.blocks().blocks),
  );

  protected headingId(index: number): string | null {
    return this.headingIds().get(index) ?? null;
  }
}
