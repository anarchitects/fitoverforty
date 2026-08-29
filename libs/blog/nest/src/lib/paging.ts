import { BadRequestException } from '@nestjs/common';

export const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 50;

export interface Paging {
  page: number;
  perPage: number;
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  label: string,
): number {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new BadRequestException(`"${label}" must be a positive integer`);
  }
  const value = Number.parseInt(raw, 10);
  if (value < 1) {
    throw new BadRequestException(`"${label}" must be at least 1`);
  }
  return value;
}

/**
 * Rejects junk rather than coercing it. A request for page "abc" is a bug
 * somewhere; silently serving page 1 hides it.
 */
export function parsePaging(page?: string, perPage?: string): Paging {
  const parsed = parsePositiveInt(perPage, DEFAULT_PER_PAGE, 'perPage');
  if (parsed > MAX_PER_PAGE) {
    throw new BadRequestException(`"perPage" must be at most ${MAX_PER_PAGE}`);
  }
  return { page: parsePositiveInt(page, 1, 'page'), perPage: parsed };
}
