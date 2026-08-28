import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '@fitoverforty/admin-angular-data-access';

/**
 * The frame every signed-in admin screen renders inside.
 *
 * Deliberately thin: two links and an identity. Everything an author actually
 * does happens on the listing and the editor, and a shell that grew navigation
 * for screens that do not exist would be designing against guesses.
 */
@Component({
  selector: 'fitoverforty-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <!--
      Plain divs, not <header> and <main>.

      This component renders inside the app shell's own <main>, so a <main>
      here would nest one landmark inside another and a <header> would add a
      second banner alongside the site header. Same class of mistake as the two
      competing h1s the site header used to produce. The <nav> stays: a second
      navigation landmark is legitimate, and aria-label is what tells them
      apart.
    -->
    <div class="admin-shell">
      <div class="admin-bar">
        <nav aria-label="Admin">
          <a routerLink="/admin">Posts</a>
          <a routerLink="/admin/posts/new">New post</a>
          <a routerLink="/">View site</a>
        </nav>

        <div class="admin-identity">
          @if (auth.user(); as user) {
            <span>{{ user.name }}</span>
          }
          <button type="button" (click)="signOut()">Sign out</button>
        </div>
      </div>

      <router-outlet />
    </div>
  `,
  styles: `
    .admin-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
      padding-block: 0.75rem;
      margin-block-end: 1.5rem;
      border-block-end: 1px solid var(--anx-sys-color-outline, currentColor);
    }

    .admin-bar nav {
      display: flex;
      gap: 1rem;
    }

    .admin-identity {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShellPage {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/admin/sign-in');
  }
}
