import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * The kettlebell outline, taken verbatim from the Looka export
 * (`brand/Logo Files/svg/symbol.svg`).
 *
 * Measured rather than eyeballed: the bounding box is 19.07, 2.83, 67.53 x 90,
 * the waist between handle and ball sits at y 47, and the ball is at its widest
 * (67.3) across y 63-67. That is what puts the counter's centre at 52.8, 69 —
 * the ball's optical middle rather than the whole mark's.
 */
const BELL =
  'M80.809,46.817c3.521-4.616,5.697-10.31,5.697-16.552c0-15.127-12.306-27.433-27.43-27.433H46.837 c-15.127,0-27.433,12.305-27.433,27.433c0,6.172,2.123,11.811,5.575,16.4c-3.719,5.424-5.912,11.976-5.912,19.051 c0,10.284,4.712,19.361,11.972,25.547c0.099,0.105,0.204,0.191,0.313,0.287c0.073,0.059,0.139,0.132,0.211,0.19h0.083 c0.851,0.646,1.873,1.092,3.037,1.092h36.299c1.167,0,2.189-0.445,3.04-1.092h0.072c0.073-0.056,0.132-0.121,0.198-0.178 c0.119-0.103,0.237-0.201,0.35-0.316c7.247-6.186,11.955-15.256,11.955-25.53C86.598,58.714,84.462,52.208,80.809,46.817z M78.072,59.135c-1.821,0.077-1.313-6.438-8.125-12.75c-7.181-6.654-15.833-4.32-15.8-6.773c0.04-2.986,6.415-1.518,10.381-0.122 c3.347,1.178,6.294,3.226,7.431,4.135c1.242,0.994,3.688,3.739,5.556,6.84C79.292,53.417,81.251,59,78.072,59.135z M71.009,37.338 c-5.256-3.373-11.471-5.384-18.177-5.384c-6.628,0-12.767,1.982-17.983,5.282c-1.2-2.061-1.938-4.421-1.938-6.97 c0-7.679,6.248-13.927,13.927-13.927h12.239c7.68,0,13.924,6.248,13.924,13.927C73,32.857,72.249,35.257,71.009,37.338z';

/** The bell's own coordinate space, so the path needs no transform. */
const MARK_VIEWBOX = '17 1 71.6 93.6';

/**
 * Wide enough for the wordmark, which is the thing that sets it — measured at
 * 138.7 units for `FITOVERFORTY` at 17px, against a bell only 67.5 wide. Sized
 * from that rather than from the bell, and centred on the bell's axis at 52.8.
 */
const LOCKUP_VIEWBOX = '-22 1 150 121';

/**
 * Bell left, lettering right, on the bell's own vertical centre. A header is
 * wide and short, so the stacked lockup would have to shrink the wordmark to
 * nothing to fit; this keeps the lettering readable at header height.
 *
 * Proportioned by the lettering rather than the bell: at 30px the wordmark's
 * cap height was under a quarter of the bell's, which reads as a caption beside
 * a picture. At 36px it is nearer a third, and the whole thing is 384 units
 * wide against a bell of 67.5.
 */
const INLINE_VIEWBOX = '17 1 384 94';

/** Left edge of the inline wordmark: the bell's right edge plus a gap. */
const INLINE_WORDMARK_X = 105;

/** The bell's vertical centre, raised by half a cap height to sit on it. */
const INLINE_BASELINE = 61;

/** Baseline of the wordmark: 13 units below the bell, which is its own width/7. */
const WORDMARK_BASELINE = 118;

let nextId = 0;

/**
 * The Fit Over Forty mark.
 *
 * Three things about it are deliberate.
 *
 * **It draws in `currentColor`.** The Looka files are monochrome — white, black,
 * or white on #323232 — which sounds like a limitation and is the opposite: a
 * mark with no colour of its own inherits the ink around it, so one component
 * serves the light theme, the dark theme and a print stylesheet with no variants
 * to keep in step. Set `color` on an ancestor to change it.
 *
 * **`40+` is knocked out of the bell, not drawn on top of it.** A mask means the
 * page shows through, so the counter reads correctly on any background. Painting
 * it in the surface colour instead would need the component to know what it is
 * sitting on, and would be wrong the moment it sat on something else.
 *
 * **The wordmark is live text.** The export has none — the lettering is outlined
 * paths in a compressed gothic that looks nothing like this site — so matching
 * the site's face was never a matter of swapping a `font-family`. Setting it as
 * text in the site's own stack means it does not merely resemble the site, it
 * *is* the site, and it follows any later change to that stack.
 */
@Component({
  selector: 'fitoverforty-logo',
  standalone: true,
  // Bound from the viewBox so a consumer can set one dimension and let the
  // other follow. Without it, `block-size: 2rem` on the host leaves the width
  // to be resolved from a percentage of an auto width, which is circular.
  host: { '[style.aspect-ratio]': 'aspectRatio()' },
  template: `
    <svg
      class="fof-logo"
      [attr.viewBox]="viewBox()"
      [attr.role]="decorative() ? null : 'img'"
      [attr.aria-hidden]="decorative() ? 'true' : null"
      [attr.aria-labelledby]="decorative() ? null : titleId"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      @if (!decorative()) {
        <title [attr.id]="titleId">{{ label() }}</title>
      }

      <defs>
        <mask [attr.id]="maskId">
          <!--
            White keeps, black cuts. The rect is not painted: it exists so the
            bell is masked against a fully opaque field rather than against
            nothing, which would leave the whole mark hidden.
          -->
          <rect x="17" y="1" width="71.6" height="93.6" fill="black" />
          <path [attr.d]="bell" fill="white" />
          @if (counter()) {
            <text
              class="fof-logo__counter"
              x="52.8"
              y="69"
              text-anchor="middle"
              dominant-baseline="central"
              fill="black"
            >
              40+
            </text>
          }
        </mask>
      </defs>

      <path [attr.d]="bell" fill="currentColor" [attr.mask]="maskRef" />

      @if (variant() === 'lockup') {
        <text
          class="fof-logo__wordmark"
          [class.fof-logo__wordmark--inline]="orientation() === 'inline'"
          [attr.x]="wordmarkX()"
          [attr.y]="wordmarkY()"
          [attr.text-anchor]="orientation() === 'inline' ? 'start' : 'middle'"
          fill="currentColor"
        >
          {{ wordmark() }}
        </text>
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
      /* A default that is visible rather than correct. Consumers set their own. */
      block-size: 2rem;
    }

    .fof-logo {
      display: block;
      block-size: 100%;
      inline-size: 100%;
    }

    /*
      Both faces come from the page, not from the component. The weights are
      stated because a heavy counter is what makes it read as part of the mark
      rather than a caption sitting inside it.
    */
    .fof-logo__counter {
      font-family: var(--font-sans, 'Manrope', 'Segoe UI', sans-serif);
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .fof-logo__wordmark {
      font-family: var(--font-sans, 'Manrope', 'Segoe UI', sans-serif);
      font-size: 17px;
      font-weight: 700;
      letter-spacing: 0.08em;
    }

    .fof-logo__wordmark--inline {
      font-size: 36px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoComponent {
  /** `mark` is the bell alone; `lockup` sets the wordmark with it. */
  readonly variant = input<'lockup' | 'mark'>('lockup');

  /**
   * Where the lettering sits. `stacked` is the export's own arrangement;
   * `inline` puts it beside the bell, which is what a header wants.
   */
  readonly orientation = input<'stacked' | 'inline'>('stacked');

  /**
   * Hides the mark from assistive technology. Correct wherever the name is
   * already in the text beside it — a header whose heading says the same thing
   * announces it twice otherwise.
   */
  readonly decorative = input(false);

  /** Announced in place of the mark when it is not decorative. */
  readonly label = input('Fit Over Forty');

  /** The lettering. Set as one word in the export; kept that way by default. */
  readonly wordmark = input('FITOVERFORTY');

  /**
   * Knocks `40+` out of the bell. Turn it off below about 48px — a favicon, an
   * inline bullet — where three characters stop being readable and start being
   * texture. Rendered down the sizes: comfortable at 64, marginal at 40, mush
   * at 32. The plain bell reads perfectly well at 16.
   */
  readonly counter = input(true);

  private readonly instance = nextId++;
  /** Unique per instance: two logos on one page must not share a mask. */
  protected readonly maskId = `fof-logo-cut-${this.instance}`;
  protected readonly titleId = `fof-logo-title-${this.instance}`;
  protected readonly maskRef = `url(#${this.maskId})`;
  protected readonly bell = BELL;

  protected readonly viewBox = computed(() => {
    if (this.variant() === 'mark') return MARK_VIEWBOX;
    return this.orientation() === 'inline' ? INLINE_VIEWBOX : LOCKUP_VIEWBOX;
  });

  protected readonly wordmarkX = computed(() =>
    this.orientation() === 'inline' ? INLINE_WORDMARK_X : 52.8,
  );

  protected readonly wordmarkY = computed(() =>
    this.orientation() === 'inline' ? INLINE_BASELINE : WORDMARK_BASELINE,
  );

  protected readonly aspectRatio = computed(() => {
    const [, , width, height] = this.viewBox().split(/\s+/).map(Number);
    return `${width} / ${height}`;
  });
}
