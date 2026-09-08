/**
 * The four content pillars, as decided on #78.
 *
 * A fixed vocabulary rather than free-form terms, because a pillar is a
 * *section* — every published post has exactly one, and the set is meant to be
 * stable enough to navigate by. Tags remain the open vocabulary underneath.
 *
 * The database holds the canonical rows; this list exists so the editor and
 * the renderer can agree on what may appear without a round trip, in the same
 * way `SUPPORTED_BLOCK_TYPES` does for blocks. A migration must **not** import
 * it — a migration has to mean the same thing for ever, and this constant is
 * free to move.
 */
export const PILLAR_SLUGS = [
  'physical-fitness',
  'mental-fitness',
  'emotional-fitness',
  'financial-fitness',
] as const;

export type PillarSlug = (typeof PILLAR_SLUGS)[number];

export function isPillarSlug(value: string): value is PillarSlug {
  return (PILLAR_SLUGS as readonly string[]).includes(value);
}
