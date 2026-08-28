import type { OutputBlockData, OutputData } from './editorjs';
import type { Heading } from './post';

/**
 * Plain text from already-sanitised inline HTML.
 *
 * A regex is sufficient precisely because the input is allowlisted on write to
 * b/i/em/strong/u/a/code/mark/br — there is no parser-defeating markup left to
 * defend against. That keeps this file free of a sanitiser dependency, which
 * matters because it is imported by the browser bundle as well as the backend.
 */
export function plainText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isHeading(block: OutputBlockData): 2 | 3 | undefined {
  if (block.type !== 'header') return undefined;
  const level = (block.data as { level?: unknown })?.level;
  return level === 2 || level === 3 ? level : undefined;
}

/**
 * Anchor id for every header block, keyed by its index in `blocks`.
 *
 * This exists so the backend and the renderer cannot disagree. The API returns
 * heading ids for a table of contents; the renderer stamps ids onto the actual
 * elements. If those were computed by two implementations, a link would
 * eventually point at nothing.
 */
export function headingIdsByBlockIndex(
  blocks: OutputBlockData[],
): Map<number, string> {
  const seen = new Map<string, number>();
  const ids = new Map<number, string>();

  blocks.forEach((block, index) => {
    if (isHeading(block) === undefined) return;
    const text = plainText(
      String((block.data as { text?: unknown })?.text ?? ''),
    );
    if (!text) return;

    const base = slugify(text) || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    ids.set(index, count === 0 ? base : `${base}-${count + 1}`);
  });

  return ids;
}

export function deriveHeadings(body: OutputData): Heading[] {
  const ids = headingIdsByBlockIndex(body.blocks);
  const headings: Heading[] = [];

  body.blocks.forEach((block, index) => {
    const depth = isHeading(block);
    const id = ids.get(index);
    if (depth === undefined || id === undefined) return;
    headings.push({
      depth,
      id,
      text: plainText(String((block.data as { text?: unknown })?.text ?? '')),
    });
  });

  return headings;
}
