# `@fitoverforty/frontend-editorjs`

An SSR-safe Angular wrapper around Editor.js, plus the tool registry and the
image-upload port.

## Why it is a library and not app code

Spec §10: build app-local behind the content contract, extract once stable.
Community epics #66–#74 describe packages for exactly this, but none of them
are published — `packages/` in the community repo holds `better-auth`,
`governance` and `nest` only — so this is where the shape gets discovered.

Nothing here imports from `fitoverforty`. That is the property that makes
extraction a move rather than a rewrite, and it is worth protecting: the
host app supplies its upload implementation through `IMAGE_UPLOADER` rather
than this library knowing any endpoint.

## The one rule

`SUPPORTED_BLOCK_TYPES` must stay in step with two other places:

- the backend's write-side validator, which rejects unknown block types
  outright rather than storing something nothing can display, and
- the public renderer, which has a branch per type.

Adding a tool here without changing both means content an author can create
but cannot save.

## SSR

Editor.js touches `window` at module scope, so it is loaded by dynamic
`import()` behind an `isPlatformBrowser` guard. A static import would break
the server render of any route that merely _references_ the component, not
only the routes that show it.

## `EditorBlock` and `EditorOutput` are aliases, not declarations

They point at `OutputBlockData` and `OutputData` in `@fitoverforty/content-model`.
This library did declare its own structural mirror once, and the two disagreed
almost immediately — this one said `data: Record<string, unknown>`, the content
model says `data: unknown` — with the result that a post loaded from the API
could not be handed back to the editor that produced it.

One structural mirror of Editor.js's types is a deliberate trade, made in the
content model so the backend does not have to install an editor. A second one
is just a place for drift.
