import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeService } from './theme.service';

/**
 * The light/dark control.
 *
 * A plain `button` with `aria-pressed`, not a checkbox or a `switch` role.
 * "Dark theme, currently on/off" is exactly what `aria-pressed` describes, and
 * a native button keeps keyboard behaviour, focus and forced-colors handling
 * without re-implementing any of it.
 *
 * The icon is `aria-hidden`: it repeats what the accessible name already says,
 * and announcing "moon" helps nobody.
 */
@Component({
  selector: 'fitoverforty-theme-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="anx-theme-toggle"
      [attr.aria-pressed]="isDark()"
      [attr.title]="label()"
      (click)="theme.toggle()"
    >
      <span aria-hidden="true" class="anx-theme-toggle__icon">{{ icon() }}</span>
      <span class="anx-theme-toggle__label">{{ label() }}</span>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly isDark = computed(
    () => this.theme.theme() === 'fitoverforty-dark',
  );
  protected readonly icon = computed(() => (this.isDark() ? '☀' : '☾'));
  protected readonly label = computed(() =>
    this.isDark() ? 'Switch to light theme' : 'Switch to dark theme',
  );
}
