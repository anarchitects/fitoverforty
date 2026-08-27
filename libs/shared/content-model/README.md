# @fitoverforty/content-model

The narrow contract between stored blog content and everything that renders it.

Framework-free on purpose: imported by the Nest backend, the Angular frontend, and
whatever a future extraction becomes. It must never import Angular, Nest or TypeORM.

## Why this exists

Content is Editor.js `OutputData` in Postgres today. It has already been markdown once,
and community epics #66–#74 may turn it into a published package tomorrow. This lib is
the seam that keeps those changes from reaching the rendering layer.

Two pieces do that work:

**`PostBody` is a discriminated union**, not an HTML string:

```ts
type PostBody = { kind: 'blocks'; blocks: OutputData } | { kind: 'html'; html: string };
```

A renderer that switches on `kind` costs nothing now. One that assumes a single shape
has to be rewritten when the shape changes — which it already has.

**`ContentSource` is a port.** Implementations return published content only; filtering
drafts and future-dated posts is the source's job, never the caller's.

## `editorjs.ts` re-declares rather than imports

`OutputData` and `OutputBlockData` mirror Editor.js's own types structurally, so values
the editor produces satisfy them without a cast. They are re-declared because Editor.js
is a browser package and this lib is consumed by the backend — installing an editor to
borrow three interfaces is the wrong trade.

When `@anarchitects/editorjs-core` publishes canonical typings, that file is the only
thing that changes.

`@fitoverforty/frontend-editorjs` re-exports these as `EditorBlock` and `EditorOutput`
rather than declaring its own. It did declare its own once, and the two disagreed within
a week — one said `data: Record<string, unknown>`, this one says `data: unknown` — so a
post loaded from the API could not be handed back to the editor that wrote it. One
structural mirror is a deliberate trade; two is a bug waiting.

## `admin.ts` is the authoring contract, and is not `Post`

`Post` is what a reader gets: always published, no identifiers, body already shaped for
the renderer. `AdminPost` is what the editor needs: the row id, the raw `OutputData` to
load back into Editor.js, drafts, and the state of the publish workflow. Sharing one
type would put a `status` field that is only ever `'published'` on the public API, and
leave the editor guessing at ids.

## Testing

```bash
corepack yarn nx run fitoverforty-content-model:test
```
