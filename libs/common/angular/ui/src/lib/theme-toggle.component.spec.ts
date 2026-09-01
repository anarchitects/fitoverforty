import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ThemeToggleComponent } from './theme-toggle.component';

describe('ThemeToggleComponent', () => {
  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.detectChanges();
    return fixture;
  };

  const button = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement.querySelector('button') as HTMLButtonElement;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-anx-theme');
    TestBed.resetTestingModule();
  });

  afterAll(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-anx-theme');
  });

  /**
   * `aria-pressed` is the whole accessible state of this control. A screen
   * reader announces "Switch to dark theme, toggle button, not pressed"; get
   * this wrong and the button is unlabelled state-wise while looking fine.
   */
  it('reports its state through aria-pressed', async () => {
    const fixture = await setup();
    expect(button(fixture).getAttribute('aria-pressed')).toBe('false');

    button(fixture).click();
    fixture.detectChanges();

    expect(button(fixture).getAttribute('aria-pressed')).toBe('true');
  });

  it('names the action it will take, not the current state', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.textContent).toContain(
      'Switch to dark theme',
    );

    button(fixture).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Switch to light theme',
    );
  });

  /** The glyph repeats the label; announcing "moon" helps nobody. */
  it('hides the decorative icon from assistive technology', async () => {
    const fixture = await setup();
    const icon = fixture.nativeElement.querySelector('.anx-theme-toggle__icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  /** A native button, so keyboard activation and focus come for free. */
  it('is a real button with an explicit type', async () => {
    const fixture = await setup();
    expect(button(fixture).tagName).toBe('BUTTON');
    expect(button(fixture).getAttribute('type')).toBe('button');
  });
});
