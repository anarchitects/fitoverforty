import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

export type AppTheme = 'fitoverforty' | 'fitoverforty-dark';

/** Where the choice is remembered. Also read by the inline script in index.html. */
export const THEME_STORAGE_KEY = 'fitoverforty-theme';

const LIGHT: AppTheme = 'fitoverforty';
const DARK: AppTheme = 'fitoverforty-dark';

/**
 * Light/dark switching, applied to `data-anx-theme` on the document element.
 *
 * **`data-anx-theme`, not `data-anx-surface`.** The design system defines
 * `surface` as `['plain', 'card']` and means *chrome* by it — `plain` is what
 * makes `.anx-surface` borderless. `theme` is free-form, so it is the axis that
 * can legitimately carry a colour scheme without changing anything else.
 *
 * The design system's own DOM sync writes `data-anx-theme` only when the
 * attribute is absent, so setting it here and in the inline boot script does
 * not fight the package — it just gets there first.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  /** The applied theme. Seeded from the DOM, which the boot script has set. */
  readonly theme = signal<AppTheme>(this.read());

  toggle(): void {
    this.set(this.theme() === DARK ? LIGHT : DARK);
  }

  set(theme: AppTheme): void {
    this.theme.set(theme);
    this.document.documentElement.setAttribute('data-anx-theme', theme);
    this.persist(theme);
  }

  private read(): AppTheme {
    const applied =
      this.document.documentElement.getAttribute('data-anx-theme');
    return applied === DARK ? DARK : LIGHT;
  }

  /**
   * Storage can throw outright — Safari in private browsing, or a browser
   * configured to block site data — so a failure to remember the choice must
   * not stop it being applied for this page.
   */
  private persist(theme: AppTheme): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        THEME_STORAGE_KEY,
        theme,
      );
    } catch {
      /* Not remembered. Still applied. */
    }
  }
}
