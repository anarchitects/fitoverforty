import type { OutputBlockData } from '@fitoverforty/content-model';

/**
 * View-side shapes for the block payloads the backend sanitiser permits.
 *
 * These mirror the handlers in the backend's block registry. If a block type
 * is added there without being added here, the renderer falls through to its
 * unknown-block branch rather than throwing.
 */
export interface ParagraphData {
  text: string;
}
export interface HeaderData {
  text: string;
  level: 2 | 3;
}
export interface ListItemData {
  content: string;
  items: ListItemData[];
}
export interface ListData {
  style: 'ordered' | 'unordered';
  items: (string | ListItemData)[];
}
export interface QuoteData {
  text: string;
  caption?: string;
}
export interface ImageData {
  file: { url: string };
  caption?: string;
}
export interface CodeData {
  code: string;
}
export interface TableData {
  withHeadings?: boolean;
  content: string[][];
}

export function dataOf<T>(block: OutputBlockData): T {
  return block.data as T;
}

/** Normalises the two list item shapes Editor.js emits into one. */
export function normaliseItems(items: ListData['items']): ListItemData[] {
  return (items ?? []).map((item) =>
    typeof item === 'string'
      ? { content: item, items: [] }
      : { content: item.content, items: normaliseItems(item.items ?? []) },
  );
}
