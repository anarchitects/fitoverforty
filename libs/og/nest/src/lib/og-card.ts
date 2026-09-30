import { markDataUri } from './mark';

/**
 * The card's palette, taken from `frontend/src/styles/themes.css`.
 *
 * Hard-coded rather than imported: those are CSS custom properties in a
 * stylesheet the backend does not compile, and a social card is always light.
 * It is never shown inside the site, so it has no theme to follow — a dark
 * card on a dark timeline and a light one on a light timeline would both be
 * wrong half the time, and the only way to be consistently right is to pick
 * one and keep it.
 */
const INK = '#1d1a15'; // --anx-ref-color-neutral-900
const PARCHMENT = '#f3f1eb'; // --anx-ref-color-neutral-0
const ACCENT = '#315934'; // --anx-ref-color-brand-700
const MUTED = 'rgba(29,26,21,0.66)';
const WATERMARK = 'rgba(49,89,52,0.07)';

/** Facebook's and X's shared preferred size, and what every scraper crops to. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export interface CardInput {
  title: string;
  description?: string;
  /**
   * The site's name, drawn as the wordmark beside the mark. Upper-cased here
   * rather than by the caller, so `SiteIdentity.name` stays in normal case for
   * everywhere else that renders it.
   */
  siteName: string;
  /** Display name, e.g. 'Physical fitness'. Upper-cased for the footer. */
  pillar?: string;
  /** Bottom-right, e.g. the bare hostname. */
  kicker?: string;
}

/**
 * Satori accepts React elements or the plain objects React elements compile
 * to. This library has no JSX pipeline — it is a Nest lib compiled by tsc —
 * so it builds the objects directly. `el` exists to keep that readable.
 */
type Node = {
  type: string;
  props: Record<string, unknown> & { children?: unknown };
};

function el(
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
): Node {
  return { type, props: { style, children } };
}

/**
 * Three sizes rather than a fitting loop.
 *
 * Satori has no way to measure text before laying it out, so fitting a title
 * would mean rendering it repeatedly and comparing heights. A short title set
 * at the long title's size looks lost on a 1200×630 canvas, and these three
 * steps cover the range real headlines occupy; anything past the last step is
 * clamped instead.
 */
export function titleSize(title: string): number {
  if (title.length <= 28) return 86;
  if (title.length <= 55) return 72;
  return 62;
}

/** Builds the element tree for one card. Pure — no fonts, no rasterising. */
export function card(input: CardInput): Node {
  const { title, description, pillar, kicker } = input;

  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: PARCHMENT,
      fontFamily: 'Manrope',
      padding: '68px 76px 0 76px',
      position: 'relative',
    },
    [
      /**
       * The mark at scale, bled off the right edge. It fills the space a short
       * title leaves empty, and it is what makes the card recognisable at the
       * size a timeline actually shows it. Kept faint enough that the body
       * text over it never drops below its own contrast.
       */
      {
        type: 'img',
        props: {
          src: markDataUri(WATERMARK),
          width: 620,
          height: 620,
          style: { position: 'absolute', top: 96, right: -168 },
        },
      },
      el('div', { display: 'flex', alignItems: 'center', gap: 20 }, [
        {
          type: 'img',
          props: { src: markDataUri(INK), width: 58, height: 58 },
        },
        el(
          'div',
          {
            fontSize: 25,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: INK,
          },
          input.siteName.toUpperCase(),
        ),
      ]),
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'center',
          // Keeps the text off the thickest part of the watermark.
          paddingRight: 150,
        },
        [
          el(
            'div',
            {
              fontFamily: 'Bitter',
              fontWeight: 600,
              fontSize: titleSize(title),
              lineHeight: 1.18,
              letterSpacing: '0.005em',
              color: INK,
              display: 'block',
              lineClamp: 3,
            },
            title,
          ),
          ...(description
            ? [
                el(
                  'div',
                  {
                    fontSize: 27,
                    lineHeight: 1.45,
                    color: MUTED,
                    marginTop: 24,
                    display: 'block',
                    lineClamp: 2,
                  },
                  description,
                ),
              ]
            : []),
        ],
      ),
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 46,
        },
        [
          el(
            'div',
            {
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '0.13em',
              color: ACCENT,
            },
            (pillar ?? '').toUpperCase(),
          ),
          el(
            'div',
            { fontSize: 22, fontWeight: 500, color: MUTED },
            kicker ?? '',
          ),
        ],
      ),
      // Full-bleed rule: the padding is cancelled rather than worked around.
      el(
        'div',
        {
          display: 'flex',
          height: 12,
          background: ACCENT,
          marginLeft: -76,
          marginRight: -76,
        },
        [],
      ),
    ],
  );
}
