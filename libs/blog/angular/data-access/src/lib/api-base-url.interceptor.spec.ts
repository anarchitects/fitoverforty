import { REQUEST } from '@angular/core';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiBaseUrlInterceptor } from './api-base-url.interceptor';

/**
 * The public origin a request arrives on behind Nginx. Nothing may be
 * addressed at it from inside the server: the whole point of the interceptor
 * is that the process talks to itself.
 */
const PUBLIC_ORIGIN = 'https://the-blog.example';

function configure(incoming: Request | null): void {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
      provideHttpClientTesting(),
      { provide: REQUEST, useValue: incoming },
    ],
  });
}

function expectRequestTo(url: string): void {
  const controller = TestBed.inject(HttpTestingController);
  controller.expectOne(url).flush(null);
  controller.verify();
}

describe('apiBaseUrlInterceptor', () => {
  const original = { ...process.env };

  afterEach(() => {
    for (const key of ['API_ORIGIN', 'PORT']) {
      delete process.env[key];
      if (original[key] !== undefined) process.env[key] = original[key];
    }
  });

  it('leaves relative URLs alone in the browser', () => {
    // There is no REQUEST token on the client, and a relative URL already
    // resolves against the page it was loaded from.
    configure(null);
    TestBed.inject(HttpClient).get('/api/blog/posts').subscribe();
    expectRequestTo('/api/blog/posts');
  });

  it('addresses loopback during SSR, not the public origin', () => {
    // The failure this guards against renders a page and then answers 503:
    // the fetch leaves the machine for a name the machine cannot resolve.
    delete process.env['API_ORIGIN'];
    process.env['PORT'] = '8080';
    configure(new Request(`${PUBLIC_ORIGIN}/blog`));
    TestBed.inject(HttpClient).get('/api/blog/posts').subscribe();
    expectRequestTo('http://127.0.0.1:8080/api/blog/posts');
  });

  it('falls back to the port main.ts defaults to', () => {
    delete process.env['API_ORIGIN'];
    delete process.env['PORT'];
    configure(new Request(`${PUBLIC_ORIGIN}/blog`));
    TestBed.inject(HttpClient).get('/api/blog/posts').subscribe();
    expectRequestTo('http://127.0.0.1:3000/api/blog/posts');
  });

  it('honours API_ORIGIN when the API is a different process', () => {
    process.env['API_ORIGIN'] = 'http://10.0.0.4:9000';
    process.env['PORT'] = '8080';
    configure(new Request(`${PUBLIC_ORIGIN}/blog`));
    TestBed.inject(HttpClient).get('/api/blog/posts').subscribe();
    expectRequestTo('http://10.0.0.4:9000/api/blog/posts');
  });

  it('does not touch a URL that is already absolute', () => {
    process.env['PORT'] = '8080';
    configure(new Request(`${PUBLIC_ORIGIN}/blog`));
    TestBed.inject(HttpClient)
      .get('https://elsewhere.example/thing')
      .subscribe();
    expectRequestTo('https://elsewhere.example/thing');
  });
});
