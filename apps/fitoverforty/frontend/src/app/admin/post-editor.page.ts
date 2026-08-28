import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { AdminPost, PostDraftInput } from '@fitoverforty/content-model';
import { BlockRendererComponent } from '@fitoverforty/frontend-blog';
import {
  EditorjsComponent,
  type EditorOutput,
} from '@fitoverforty/frontend-editorjs';
import { SeoService } from '@fitoverforty/seo-angular';
import { MediaApi } from './media.api';
import { PostsApi } from './posts.api';

type Mode = 'write' | 'preview';

/** An empty document, so the renderer has something to render before typing. */
const EMPTY: EditorOutput = { blocks: [] };

/**
 * Write a post, preview it, publish it.
 *
 * The preview renders through `BlockRendererComponent` — the same component
 * the public post page uses — rather than through Editor.js's own editing
 * surface. §9 calls this out specifically: a preview built from a second
 * renderer drifts from the real one, and the drift is only ever discovered
 * after something is published.
 *
 * Two things it deliberately does not do, so neither reads as an oversight.
 * It renders what the *editor* holds rather than what the server stored, so
 * markup the write-side allowlist would strip still appears here — Angular's
 * sanitizer is the same one the public page relies on, so the dangerous cases
 * are handled by the same mechanism either way. And it shows the body only,
 * not the hero or the post furniture; the body is where two renderers would
 * drift, and the rest is page layout the editor has no say over.
 */
@Component({
  selector: 'app-admin-post-editor',
  standalone: true,
  imports: [
    BlockRendererComponent,
    DatePipe,
    EditorjsComponent,
    FormsModule,
    RouterLink,
  ],
  template: `
    <section class="anx-section admin-editor">
      <div class="admin-editor-head">
        <h1>{{ post() ? 'Edit post' : 'New post' }}</h1>
        <a routerLink="/admin">Back to all posts</a>
      </div>

      @if (status(); as state) {
        <p class="admin-status" [class.is-error]="state.kind === 'error'" role="status">
          {{ state.text }}
        </p>
      }

      @if (post(); as saved) {
        <p class="admin-state">
          @if (saved.status === 'draft') {
            Draft — not visible on the site.
          } @else if (saved.scheduled) {
            Scheduled for
            {{ saved.publishedAt | date: 'medium' }} — not visible until then.
          } @else {
            Published
            <a [href]="'/blog/' + saved.slug" target="_blank" rel="noopener">
              /blog/{{ saved.slug }}
            </a>
          }
        </p>
      }

      <div class="admin-fields">
        <label>
          <span>Title</span>
          <input name="title" [(ngModel)]="title" maxlength="200" />
        </label>

        <label>
          <span>Slug</span>
          <input name="slug" [(ngModel)]="slug" placeholder="derived from the title" />
          @if (post()?.status === 'published') {
            <small>
              This post is published. Changing the slug changes its URL, and
              any link already shared will stop working.
            </small>
          }
        </label>

        <label>
          <span>Description</span>
          <textarea name="description" [(ngModel)]="description" maxlength="160" rows="2"></textarea>
          <small>{{ description().length }}/160 — used as the meta description and in the feed.</small>
        </label>

        <label>
          <span>Tags</span>
          <input name="tags" [(ngModel)]="tagText" placeholder="Strength, Recovery" />
          <small>Comma separated. At most eight.</small>
        </label>
      </div>

      <fieldset class="admin-hero">
        <legend>Hero image</legend>

        @if (hero(); as image) {
          <img [src]="image.url" [alt]="heroAlt()" class="admin-hero-preview" />
          <label>
            <span>Alt text</span>
            <input name="heroAlt" [(ngModel)]="heroAlt" />
            <small>
              Required before publishing. Describe what the image shows for
              readers who cannot see it.
            </small>
          </label>
          <button type="button" (click)="clearHero()">Remove hero image</button>
        } @else {
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            (change)="pickHero($event)"
          />
        }
      </fieldset>

      <div class="admin-mode" role="group" aria-label="Editor mode">
        <button type="button" [disabled]="mode() === 'write'" (click)="mode.set('write')">
          Write
        </button>
        <button type="button" [disabled]="mode() === 'preview'" (click)="mode.set('preview')">
          Preview
        </button>
      </div>

      <!--
        Both stay in the DOM. Destroying the editor to show the preview would
        throw away undo history and the caret position every time somebody
        looked at their own post.
      -->
      <div [hidden]="mode() !== 'write'">
        <fitoverforty-editorjs
          [initialData]="loadedBody()"
          (contentChange)="body.set($event)"
          (ready)="editorReady.set(true)"
        />
      </div>

      @if (mode() === 'preview') {
        <article class="blog-post admin-preview">
          <h1>{{ title() || 'Untitled' }}</h1>
          <!--
            showUnknown is on here and off in production rendering: a block the
            renderer does not handle should be loud to the person who just
            added it, and invisible to a reader.
          -->
          <fitoverforty-block-renderer [blocks]="body() ?? empty" [showUnknown]="true" />
        </article>
      }

      <div class="admin-actions">
        <button type="button" (click)="saveDraft()" [disabled]="busy()">
          Save draft
        </button>

        <button type="button" (click)="publishNow()" [disabled]="busy()">
          {{ post()?.status === 'published' ? 'Save and republish' : 'Publish now' }}
        </button>

        <label class="admin-schedule">
          <span>Schedule for</span>
          <input type="datetime-local" name="scheduleAt" [(ngModel)]="scheduleAt" />
          <button type="button" (click)="schedule()" [disabled]="busy() || !scheduleAt()">
            Schedule
          </button>
        </label>

        @if (post()?.status === 'published') {
          <button type="button" (click)="unpublish()" [disabled]="busy()">
            Unpublish
          </button>
        }
      </div>
    </section>
  `,
  styles: `
    .admin-editor-head {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
    }

    .admin-fields {
      display: grid;
      gap: 1rem;
      margin-block: 1rem;
    }

    .admin-fields label,
    .admin-hero label {
      display: grid;
      gap: 0.25rem;
    }

    .admin-fields input,
    .admin-fields textarea,
    .admin-hero input[type='text'] {
      inline-size: 100%;
    }

    .admin-hero {
      margin-block-end: 1rem;
    }

    .admin-hero-preview {
      max-inline-size: min(100%, 20rem);
      block-size: auto;
      margin-block-end: 0.5rem;
    }

    .admin-mode {
      display: flex;
      gap: 0.5rem;
      margin-block-end: 1rem;
    }

    .admin-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      margin-block-start: 1.5rem;
    }

    .admin-schedule {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .admin-status {
      padding: 0.75rem 1rem;
      border-inline-start: 3px solid currentColor;
    }

    .admin-status.is-error {
      color: var(--anx-sys-color-error, currentColor);
    }

    .admin-preview {
      padding: 1rem;
      border: 1px dashed var(--anx-sys-color-outline, currentColor);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostEditorPage {
  private readonly posts = inject(PostsApi);
  private readonly media = inject(MediaApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly empty = EMPTY;

  readonly title = signal('');
  readonly slug = signal('');
  readonly description = signal('');
  readonly tagText = signal('');
  readonly heroAlt = signal('');
  readonly scheduleAt = signal('');

  readonly hero = signal<{ mediaId: string; url: string } | null>(null);
  readonly body = signal<EditorOutput | null>(null);
  /**
   * What the editor was seeded with, which is not the same signal as `body`.
   *
   * `initialData` is read once when Editor.js mounts. Feeding it `body` would
   * make every keystroke a new input value for a component that ignores it,
   * and would re-seed the editor with its own output if it ever remounted.
   */
  readonly loadedBody = signal<EditorOutput | null>(null);
  readonly editorReady = signal(false);

  readonly mode = signal<Mode>('write');
  readonly post = signal<AdminPost | null>(null);
  readonly busy = signal(false);
  readonly status = signal<{ kind: 'info' | 'error'; text: string } | null>(
    null,
  );

  private readonly id = computed(
    () => this.route.snapshot.paramMap.get('id') ?? null,
  );

  constructor() {
    inject(SeoService).apply({
      title: 'Compose',
      description: 'Administration for Fit Over Forty.',
      path: '/admin/posts',
      noIndex: true,
    });

    const id = this.id();
    if (id) void this.loadExisting(id);
  }

  private async loadExisting(id: string): Promise<void> {
    this.busy.set(true);
    try {
      this.apply(await this.posts.load(id));
      this.loadedBody.set(this.post()?.body ?? EMPTY);
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  /** Pushes a server response back into the form, so the two cannot disagree. */
  private apply(saved: AdminPost): void {
    this.post.set(saved);
    this.title.set(saved.title);
    this.slug.set(saved.slug);
    this.description.set(saved.description);
    this.tagText.set(saved.tags.map((tag) => tag.name).join(', '));
    this.hero.set(
      saved.hero ? { mediaId: saved.hero.mediaId, url: saved.hero.src } : null,
    );
    this.heroAlt.set(saved.hero?.alt ?? '');
  }

  private draft(): PostDraftInput {
    return {
      title: this.title(),
      slug: this.slug(),
      description: this.description(),
      // The editor's last emission, or what was loaded if nothing was typed.
      body: this.body() ?? this.loadedBody() ?? EMPTY,
      tags: this.tagText()
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      heroMediaId: this.hero()?.mediaId ?? null,
      heroAlt: this.heroAlt(),
    };
  }

  /**
   * Saves, and returns the id — creating the post if this is the first save.
   *
   * Every action funnels through here, including publishing. Publishing
   * whatever the server last saw rather than what is on screen is the classic
   * way to publish a version nobody wrote.
   */
  private async persist(): Promise<string> {
    const existing = this.post();
    const saved = existing
      ? await this.posts.update(existing.id, this.draft())
      : await this.posts.create(this.draft());

    this.apply(saved);

    // The URL carries the id from here on, so a reload does not create a
    // second post. `replaceUrl` keeps Back going where the author expects.
    if (!existing) {
      await this.router.navigate(['/admin/posts', saved.id], {
        replaceUrl: true,
      });
    }
    return saved.id;
  }

  async saveDraft(): Promise<void> {
    await this.run('Saved.', async () => {
      await this.persist();
    });
  }

  async publishNow(): Promise<void> {
    await this.run('Published.', async () => {
      const id = await this.persist();
      this.apply(await this.posts.publish(id));
    });
  }

  async schedule(): Promise<void> {
    const local = this.scheduleAt();
    if (!local) return;
    // datetime-local has no timezone; the browser's own is the right reading,
    // and toISOString is what makes that explicit before it leaves.
    const at = new Date(local).toISOString();

    await this.run('Scheduled.', async () => {
      const id = await this.persist();
      this.apply(await this.posts.publish(id, at));
    });
  }

  async unpublish(): Promise<void> {
    const existing = this.post();
    if (!existing) return;
    await this.run('Unpublished — back to draft.', async () => {
      this.apply(await this.posts.unpublish(existing.id));
    });
  }

  async pickHero(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    await this.run('Hero image uploaded.', async () => {
      const uploaded = await this.media.upload(file);
      this.hero.set({ mediaId: uploaded.mediaId, url: uploaded.url });
    });
  }

  clearHero(): void {
    this.hero.set(null);
    this.heroAlt.set('');
  }

  /** One place that owns the busy flag and turns a rejection into a message. */
  private async run(success: string, work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.status.set(null);
    try {
      await work();
      this.status.set({ kind: 'info', text: success });
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  private fail(error: unknown): void {
    this.status.set({
      kind: 'error',
      text: error instanceof Error ? error.message : 'Something went wrong.',
    });
  }
}
