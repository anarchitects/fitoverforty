import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type {
  OutputBlockData,
  OutputData,
} from '@fitoverforty/content-model';
import { IMAGE_UPLOADER } from './image-upload.port';
import { buildTools } from './tool-registry';

/**
 * The editor's payload types, which are the content model's.
 *
 * Aliased rather than re-declared. There was a second structural mirror here,
 * and it drifted immediately: this one said `data: Record<string, unknown>`
 * where the content model says `data: unknown`, so a post loaded from the API
 * could not be handed back to the editor that produced it. One declaration
 * cannot disagree with itself.
 *
 * The names stay because callers use them, and because "the editor's output"
 * is what they mean at this boundary.
 */
export type EditorBlock = OutputBlockData;
export type EditorOutput = OutputData;

type EditorInstance = {
  isReady: Promise<void>;
  save(): Promise<EditorOutput>;
  destroy?: () => void;
};

/**
 * Editor.js in an Angular component.
 *
 * The whole library is loaded by dynamic `import()` behind an
 * `isPlatformBrowser` guard (community epic #69). Editor.js touches `window`
 * and `document` at module scope, so a static import would crash the server
 * render of any route that so much as references this component — not only the
 * routes that display it.
 */
@Component({
  selector: 'fitoverforty-editorjs',
  standalone: true,
  template: `
    <div class="fitoverforty-editorjs">
      <div #host class="fitoverforty-editorjs__host"></div>

      @if (status() === 'loading') {
        <p class="fitoverforty-editorjs__status" role="status">
          Loading the editor…
        </p>
      }
      @if (status() === 'failed') {
        <p class="fitoverforty-editorjs__status" role="alert">
          The editor failed to load. Reload the page to try again.
        </p>
      }
    </div>
  `,
  styles: `
    .fitoverforty-editorjs__host {
      min-block-size: 12rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorjsComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly uploader = inject(IMAGE_UPLOADER);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  /** Content to open with. Read once, when the editor is created. */
  readonly initialData = input<EditorOutput | null>(null);
  readonly placeholder = input('Write something…');
  readonly readOnly = input(false);

  /** Fires on every change, carrying the full saved payload. */
  readonly contentChange = output<EditorOutput>();
  readonly ready = output<void>();

  readonly status = signal<'idle' | 'loading' | 'ready' | 'failed'>('idle');

  private editor: EditorInstance | null = null;
  /**
   * Set before the first `await`, so a component destroyed mid-load does not
   * end up with a live editor attached to a detached element. Without it, a
   * fast navigation away leaves the instance running and its listeners bound.
   */
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.teardown();
    });

    if (isPlatformBrowser(this.platformId)) {
      void this.create();
    }
  }

  /** The current content, or null when the editor never finished loading. */
  async save(): Promise<EditorOutput | null> {
    if (!this.editor) return null;
    return this.editor.save();
  }

  private async create(): Promise<void> {
    this.status.set('loading');

    try {
      /**
       * Imported together rather than one await at a time: these are eight
       * independent chunks, and awaiting them in sequence would serialise
       * eight round trips on a cold cache for no reason.
       */
      const [
        EditorJS,
        Header,
        List,
        Quote,
        ImageTool,
        CodeTool,
        Table,
        Delimiter,
      ] = await Promise.all([
        import('@editorjs/editorjs').then((m) => m.default),
        import('@editorjs/header').then((m) => m.default),
        import('@editorjs/list').then((m) => m.default),
        import('@editorjs/quote').then((m) => m.default),
        import('@editorjs/image').then((m) => m.default),
        import('@editorjs/code').then((m) => m.default),
        import('@editorjs/table').then((m) => m.default),
        import('@editorjs/delimiter').then((m) => m.default),
      ]);

      if (this.destroyed) return;

      const initial = this.initialData();

      const instance = new (EditorJS as new (
        config: unknown,
      ) => EditorInstance)({
        holder: this.host().nativeElement,
        placeholder: this.placeholder(),
        readOnly: this.readOnly(),
        minHeight: 0,
        ...(initial && initial.blocks.length > 0 ? { data: initial } : {}),
        tools: buildTools(
          { Header, List, Quote, ImageTool, CodeTool, Table, Delimiter },
          { uploader: this.uploader },
        ),
        /**
         * Never allowed to reject.
         *
         * `onChange` fires for cursor moves and tune changes too, so the
         * payload is re-read rather than assumed from the event — and
         * `save()` can fail while a tool is mid-flight, an image tool waiting
         * on an upload being the obvious case. Letting that rejection escape
         * into Editor.js's own listener risks losing every later
         * notification, which presents as an editor that quietly stops
         * reporting what the author typed.
         */
        onChange: () => {
          void instance
            .save()
            .then((output) => {
              if (!this.destroyed) this.contentChange.emit(output);
            })
            .catch((error: unknown) => {
              console.error('Editor.js could not save on change', error);
            });
        },
      });

      this.editor = instance;
      await instance.isReady;

      if (this.destroyed) {
        this.teardown();
        return;
      }

      this.status.set('ready');
      this.ready.emit();
    } catch (error) {
      console.error('Editor.js failed to load', error);
      this.status.set('failed');
    }
  }

  private teardown(): void {
    // `destroy` is optional in Editor.js's own types and absent on a partially
    // constructed instance, so this cannot assume it is there.
    try {
      this.editor?.destroy?.();
    } catch (error) {
      console.error('Editor.js failed to tear down cleanly', error);
    }
    this.editor = null;
  }
}
