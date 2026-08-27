import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  EditorjsComponent,
  type EditorOutput,
} from '@fitoverforty/frontend-editorjs';
import { SeoService } from '../seo/seo.service';

/**
 * A working editor with nowhere to save to.
 *
 * Step 7 is the wrapper; persistence and the publish workflow are step 9. This
 * page exists so the wrapper is exercised for real — mounted, typed into, torn
 * down on navigation — rather than only under test doubles, and it says
 * plainly that nothing is stored so nobody writes a post here and loses it.
 */
@Component({
  selector: 'app-admin-compose',
  standalone: true,
  imports: [EditorjsComponent],
  template: `
    <section class="anx-section">
      <h1>Compose</h1>

      <p class="admin-warning" role="status">
        Nothing here is saved yet. The editor works, but publishing is a later
        step — anything you write on this page is lost when you leave it.
      </p>

      <fitoverforty-editorjs
        (contentChange)="output.set($event)"
        (ready)="ready.set(true)"
      />

      <h2>What the editor produced</h2>
      <p>
        This is the payload that will be sent to the API once saving exists. It
        is shown because the shape is the contract: the server validates every
        block against it and rejects anything it does not recognise.
      </p>

      @if (output(); as data) {
        <p>{{ data.blocks.length }} block(s).</p>
        <pre class="admin-payload"><code>{{ pretty(data) }}</code></pre>
      } @else {
        <p>{{ ready() ? 'Start typing.' : 'Waiting for the editor…' }}</p>
      }
    </section>
  `,
  styles: `
    .admin-warning {
      padding: 0.75rem 1rem;
      margin-block-end: 1rem;
      border-inline-start: 3px solid currentColor;
    }

    .admin-payload {
      overflow-x: auto;
      padding: 1rem;
      font-size: 0.85rem;
      background: var(--anx-sys-color-surface-variant, rgb(0 0 0 / 5%));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComposePage {
  readonly output = signal<EditorOutput | null>(null);
  readonly ready = signal(false);

  constructor() {
    inject(SeoService).apply({
      title: 'Compose',
      description: 'Administration for Fit Over Forty.',
      path: '/admin/compose',
      noIndex: true,
    });
  }

  pretty(data: EditorOutput): string {
    return JSON.stringify(data, null, 2);
  }
}
