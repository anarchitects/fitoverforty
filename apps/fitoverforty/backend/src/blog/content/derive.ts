import type { Heading, OutputData } from '@fitoverforty/content-model';
import { toPlainText } from './inline-html';

const WORDS_PER_MINUTE = 200;

type Data = Record<string, unknown>;

function collectListText(items: unknown, into: string[]): void {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (typeof item === 'string') {
      into.push(item);
    } else if (item && typeof item === 'object') {
      const record = item as Data;
      if (typeof record['content'] === 'string') into.push(record['content']);
      collectListText(record['items'], into);
    }
  }
}

/** Every text-bearing field, already sanitised, as raw strings. */
function collectText(body: OutputData): string[] {
  const parts: string[] = [];
  for (const block of body.blocks) {
    const data = (block.data ?? {}) as Data;
    switch (block.type) {
      case 'paragraph':
      case 'header':
        if (typeof data['text'] === 'string') parts.push(data['text']);
        break;
      case 'quote':
        if (typeof data['text'] === 'string') parts.push(data['text']);
        if (typeof data['caption'] === 'string') parts.push(data['caption']);
        break;
      case 'image':
        if (typeof data['caption'] === 'string') parts.push(data['caption']);
        break;
      case 'list':
        collectListText(data['items'], parts);
        break;
      case 'code':
        if (typeof data['code'] === 'string') parts.push(data['code']);
        break;
      case 'table':
        if (Array.isArray(data['content'])) {
          for (const row of data['content'] as unknown[]) {
            if (Array.isArray(row)) {
              for (const cell of row) {
                if (typeof cell === 'string') parts.push(cell);
              }
            }
          }
        }
        break;
      default:
        break;
    }
  }
  return parts;
}

/**
 * Computed on write and stored, so listing pages never parse block JSON.
 * Minimum of one minute: "0 min read" reads as a bug.
 */
export function readingTimeMinutes(body: OutputData): number {
  const words = collectText(body)
    .map(toPlainText)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Anchor ids for a future table of contents. Duplicate headings get a numeric
 * suffix rather than colliding, since an id has to address one element.
 */
export function extractHeadings(body: OutputData): Heading[] {
  const seen = new Map<string, number>();
  const headings: Heading[] = [];

  for (const block of body.blocks) {
    if (block.type !== 'header') continue;
    const data = (block.data ?? {}) as Data;
    const level = data['level'];
    if (level !== 2 && level !== 3) continue;
    const text = toPlainText(String(data['text'] ?? ''));
    if (!text) continue;

    const base = slugify(text) || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);

    headings.push({
      depth: level,
      id: count === 0 ? base : `${base}-${count + 1}`,
      text,
    });
  }
  return headings;
}
