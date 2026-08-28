import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

interface SessionResponse {
  user?: AdminUser | null;
}

/**
 * `unknown` is a real state, not a placeholder for `signed-out`.
 *
 * On a cold load the app has not asked the server yet, and treating that as
 * signed-out would flash the sign-in form at someone who is already signed in.
 */
export type AuthStatus = 'unknown' | 'signed-in' | 'signed-out';

/**
 * Talks to Better Auth's HTTP endpoints directly rather than through
 * `better-auth/client`.
 *
 * Three calls are needed — sign in, sign out, read the session — and they are
 * plain JSON over the same `/api` prefix everything else here uses, so the
 * client library would add a dependency and a second HTTP stack without
 * replacing any logic. Going through `HttpClient` also means these requests
 * pass through `apiBaseUrlInterceptor` like every other call in the app.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly state = signal<{
    status: AuthStatus;
    user: AdminUser | null;
  }>({ status: 'unknown', user: null });

  readonly status = computed(() => this.state().status);
  readonly user = computed(() => this.state().user);
  readonly isSignedIn = computed(() => this.state().status === 'signed-in');

  /**
   * Reads the session from the cookie.
   *
   * Returns the resolved status rather than void so the route guard can act on
   * it without re-reading the signal, which would otherwise be a subtle
   * ordering dependency.
   */
  async refresh(): Promise<AuthStatus> {
    try {
      const response = await firstValueFrom(
        this.http.get<SessionResponse | null>('/api/auth/get-session', {
          withCredentials: true,
        }),
      );
      const user = response?.user ?? null;
      this.state.set({
        status: user ? 'signed-in' : 'signed-out',
        user,
      });
    } catch {
      // A failed session read is not proof of being signed out, but it is the
      // only safe assumption: the alternative is showing the admin area to
      // someone whose session could not be confirmed.
      this.state.set({ status: 'signed-out', user: null });
    }
    return this.state().status;
  }

  /** Resolves to an error message, or null when sign-in succeeded. */
  async signIn(email: string, password: string): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.http.post<SessionResponse>(
          '/api/auth/sign-in/email',
          { email, password },
          { withCredentials: true },
        ),
      );
      const user = response?.user ?? null;
      if (!user) return 'Sign-in did not return an account.';
      this.state.set({ status: 'signed-in', user });
      return null;
    } catch {
      /**
       * Deliberately does not distinguish "no such account" from "wrong
       * password". Saying which one is wrong tells an attacker which
       * addresses are real.
       */
      return 'That email address and password do not match an account.';
    }
  }

  /**
   * Never rejects.
   *
   * Callers navigate away immediately afterwards, and a rejection here would
   * skip that navigation and strand someone on an admin screen they have just
   * asked to leave. The server-side failure is swallowed rather than surfaced
   * because there is nothing useful to offer: retrying sign-out is not an
   * action worth asking for.
   */
  async signOut(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post('/api/auth/sign-out', {}, { withCredentials: true }),
      );
    } catch {
      // The cookie may survive on the server, but leaving the UI in a
      // signed-in state after someone pressed sign out is the worse outcome.
    }
    this.state.set({ status: 'signed-out', user: null });
  }
}
