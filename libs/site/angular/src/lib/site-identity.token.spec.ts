import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FIT_OVER_FORTY } from '@fitoverforty/site-ts';
import { SITE_IDENTITY, provideSiteIdentity } from './site-identity.token';

@Component({
  selector: 'fitoverforty-identity-probe',
  template: '{{ identity.name }}',
})
class ProbeComponent {
  readonly identity = inject(SITE_IDENTITY);
}

describe('provideSiteIdentity', () => {
  it('makes the identity injectable into a component', () => {
    TestBed.configureTestingModule({
      imports: [ProbeComponent],
      providers: [provideSiteIdentity(FIT_OVER_FORTY)],
    });
    const fixture = TestBed.createComponent(ProbeComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      FIT_OVER_FORTY.name,
    );
  });

  it('throws rather than defaulting when nothing provides it', () => {
    // The point of the token having no default. A library that renders a
    // fallback name works in every application and is wrong in all but one of
    // them, and nothing fails to say so.
    TestBed.configureTestingModule({ imports: [ProbeComponent] });

    expect(() => TestBed.createComponent(ProbeComponent)).toThrow();
  });
});
