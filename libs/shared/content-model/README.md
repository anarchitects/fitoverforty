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

## Testing

```bash
corepack yarn nx run fitoverforty-content-model:test
```
