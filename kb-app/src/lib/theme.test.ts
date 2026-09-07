import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getInitialTheme, getStoredTheme, initTheme, setTheme } from './theme';

function mockMatchMedia(prefersDark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: prefersDark,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applyTheme sets the data-theme attribute on <html>', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('setTheme persists to localStorage and applies the attribute', () => {
    setTheme('dark');
    expect(localStorage.getItem('kb-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('setTheme dispatches a kb-theme-change window event', () => {
    const handler = vi.fn();
    window.addEventListener('kb-theme-change', handler);
    setTheme('dark');
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('kb-theme-change', handler);
  });

  it('getStoredTheme returns null when nothing was stored', () => {
    expect(getStoredTheme()).toBeNull();
  });

  it('getStoredTheme returns the persisted value', () => {
    setTheme('light');
    expect(getStoredTheme()).toBe('light');
  });

  it('getInitialTheme prefers a stored value over system preference', () => {
    mockMatchMedia(true); // system prefers dark
    setTheme('light'); // but user chose light
    expect(getInitialTheme()).toBe('light');
  });

  it('getInitialTheme falls back to system preference when nothing stored', () => {
    mockMatchMedia(true);
    expect(getInitialTheme()).toBe('dark');
  });

  it('initTheme applies the initial theme immediately', () => {
    mockMatchMedia(false);
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('initTheme syncs with system preference changes only when no override is stored', () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | undefined;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
        changeHandler = handler;
      },
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    initTheme();
    changeHandler?.({ matches: true } as MediaQueryListEvent);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('initTheme returns an unsubscribe function', () => {
    mockMatchMedia(false);
    const unsubscribe = initTheme();
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});
