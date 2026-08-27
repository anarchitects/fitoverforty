/**
 * The block types a post body may contain.
 *
 * Canonical, and deliberately here rather than in any of the three places that
 * need it. Those three are:
 *
 *  - the backend validator, which rejects unknown types on write rather than
 *    storing a block nothing can display;
 *  - the public renderer, which has a branch per type;
 *  - the editor's tool registry, which decides what an author can create.
 *
 * They fail in different directions when they disagree, and only one of those
 * failures is loud. A renderer missing a type shows an unknown-block notice; a
 * validator missing one rejects the save with a clear error. But a *tool*
 * offering a type the validator does not accept lets someone write a whole
 * post and discover on save that it cannot be stored — which is the worst of
 * the three and the reason this list has one home.
 */
export const SUPPORTED_BLOCK_TYPES = [
  'paragraph',
  'header',
  'list',
  'quote',
  'image',
  'code',
  'delimiter',
  'table',
] as const;

export type SupportedBlockType = (typeof SUPPORTED_BLOCK_TYPES)[number];

export function isSupportedBlockType(type: string): type is SupportedBlockType {
  return (SUPPORTED_BLOCK_TYPES as readonly string[]).includes(type);
}

/**
 * The list styles a `list` block may use.
 *
 * Narrower than the editor's list tool, which also offers a checklist. A
 * checklist would need a `meta.checked` flag per item, a renderer branch and a
 * validator rule, and has none of them — so it is excluded at the toolbar
 * rather than accepted and rejected on save.
 */
export const SUPPORTED_LIST_STYLES = ['ordered', 'unordered'] as const;

export type SupportedListStyle = (typeof SUPPORTED_LIST_STYLES)[number];
