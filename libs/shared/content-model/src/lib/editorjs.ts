/**
 * Structural mirror of Editor.js's own `OutputData`.
 *
 * Deliberately re-declared rather than imported from `@editorjs/editorjs`: the
 * editor is a browser package, and this lib is consumed by the backend, where
 * pulling in an editor to borrow three interfaces is the wrong trade. The
 * shapes below are structurally assignable to Editor.js's, so a value produced
 * by the editor satisfies them without a cast.
 *
 * When `@anarchitects/editorjs-core` publishes canonical typings (community
 * epic #66), this file is the single place that changes.
 */

export interface OutputBlockData<Type extends string = string, Data = unknown> {
  id?: string;
  type: Type;
  data: Data;
  tunes?: Record<string, unknown>;
}

export interface OutputData {
  /** Editor.js's own schema version. Distinct from our `bodySchemaVersion`. */
  version?: string;
  time?: number;
  blocks: OutputBlockData[];
}
