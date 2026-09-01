import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ThemeService, THEME_STORAGE_KEY } from './theme.service';

describe('ThemeService', () => {
  const themeAttr = () =>
    document.documentElement.getAttribute('data-anx-theme');

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-anx-theme');
    TestBed.resetTestingModule();
  });

  afterAll(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-anx-theme');
  });

  it('seeds from the attribute the boot script already applied', () => {
    document.documentElement.setAttribute(
      'data-anx-theme',
      'fitoverforty-dark',
    );
    expect(TestBed.inject(ThemeService).theme()).toBe('fitoverforty-dark');
  });

  it('treats an absent attribute as the light theme', () => {
    expect(TestBed.inject(ThemeService).theme()).toBe('fitoverforty');
  });

  it('toggles both ways, writing the attribute and remembering the choice', () => {
    const service = TestBed.inject(ThemeService);

    service.toggle();
    expect(service.theme()).toBe('fitoverforty-dark');
    expect(themeAttr()).toBe('fitoverforty-dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('fitoverforty-dark');

    service.toggle();
    expect(service.theme()).toBe('fitoverforty');
    expect(themeAttr()).toBe('fitoverforty');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('fitoverforty');
  });

  /**
   * `data-anx-surface` is the design system's own axis and means chrome
   * (`plain` / `card`), not colour scheme. An earlier version of the theme CSS
   * keyed dark off it, which meant changing colour silently changed border
   * behaviour. Nothing here may touch it.
   */
  it('never touches data-anx-surface', () => {
    document.documentElement.setAttribute('data-anx-surface', 'plain');
    TestBed.inject(ThemeService).toggle();
    expect(document.documentElement.getAttribute('data-anx-surface')).toBe(
      'plain',
    );
    document.documentElement.removeAttribute('data-anx-surface');
  });

  /**
   * Safari in private browsing, and browsers configured to block site data,
   * throw from localStorage rather than returning null. Failing to *remember*
   * the choice must not stop it being *applied* for this page.
   */
  it('still applies the theme when storage throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });

    const service = TestBed.inject(ThemeService);
    expect(() => service.toggle()).not.toThrow();
    expect(themeAttr()).toBe('fitoverforty-dark');
    expect(service.theme()).toBe('fitoverforty-dark');

    spy.mockRestore();
  });
});
