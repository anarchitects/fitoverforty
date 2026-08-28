import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts unknown rather than signed out', () => {
    // Treating a cold load as signed-out flashes the sign-in form at someone
    // who is in fact signed in.
    expect(service.status()).toBe('unknown');
    expect(service.isSignedIn()).toBe(false);
  });

  it('resolves to signed-in when the session has a user', async () => {
    const pending = service.refresh();
    http
      .expectOne('/api/auth/get-session')
      .flush({ user: { id: '1', email: 'a@b.co', name: 'A' } });

    await expect(pending).resolves.toBe('signed-in');
    expect(service.user()?.email).toBe('a@b.co');
  });

  it('resolves to signed-out when the session is null', async () => {
    const pending = service.refresh();
    http.expectOne('/api/auth/get-session').flush(null);

    await expect(pending).resolves.toBe('signed-out');
    expect(service.user()).toBeNull();
  });

  it('treats a failed session read as signed out', async () => {
    const pending = service.refresh();
    http
      .expectOne('/api/auth/get-session')
      .flush('nope', { status: 500, statusText: 'Server Error' });

    await expect(pending).resolves.toBe('signed-out');
  });

  it('sends credentials, since the session lives in a cookie', () => {
    void service.refresh();
    expect(
      http.expectOne('/api/auth/get-session').request.withCredentials,
    ).toBe(true);
  });

  it('signs in and reports no error', async () => {
    const pending = service.signIn('a@b.co', 'a-real-password');
    const request = http.expectOne('/api/auth/sign-in/email');
    expect(request.request.body).toEqual({
      email: 'a@b.co',
      password: 'a-real-password',
    });
    request.flush({ user: { id: '1', email: 'a@b.co', name: 'A' } });

    await expect(pending).resolves.toBeNull();
    expect(service.isSignedIn()).toBe(true);
  });

  /**
   * The message must not say whether the address exists — that would let
   * someone enumerate which addresses are real.
   */
  it('gives the same message whoever failed', async () => {
    const wrongPassword = service.signIn('real@b.co', 'wrong');
    http
      .expectOne('/api/auth/sign-in/email')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    const first = await wrongPassword;

    const noSuchUser = service.signIn('ghost@b.co', 'whatever');
    http
      .expectOne('/api/auth/sign-in/email')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    const second = await noSuchUser;

    expect(first).toBe(second);
    expect(first).not.toBeNull();
    expect(service.isSignedIn()).toBe(false);
  });

  it('clears local state even when sign-out fails on the server', async () => {
    const signingIn = service.signIn('a@b.co', 'pw');
    http
      .expectOne('/api/auth/sign-in/email')
      .flush({ user: { id: '1', email: 'a@b.co', name: 'A' } });
    await signingIn;

    const pending = service.signOut();
    http
      .expectOne('/api/auth/sign-out')
      .flush('nope', { status: 500, statusText: 'Server Error' });
    await pending;

    expect(service.isSignedIn()).toBe(false);
    expect(service.user()).toBeNull();
  });
});
