const STORAGE_KEY = 'kb-theme';

export type Theme = 'light' | 'dark';
/** What the user chose: an explicit theme, or "follow the OS". */
export type ThemePreference = Theme | 'system';

// sRGB equivalents of --kb-bg in tokens.css, for the browser chrome
// (address bar / task switcher) which can't read CSS custom properties.
const THEME_COLOR: Record<Theme, string> = {
  light: '#f5f7fa',
  dark: '#111419',
};

export function getCurrentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : null;
}

export function getThemePreference(): ThemePreference {
  return getStoredTheme() ?? 'system';
}

export function getInitialTheme(): Theme {
  return getStoredTheme() ?? (systemPrefersDark() ? 'dark' : 'light');
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event('kb-theme-change'));
}

/** Like setTheme, but "system" drops the stored override and re-follows the OS. */
export function setThemePreference(preference: ThemePreference): void {
  if (preference !== 'system') {
    setTheme(preference);
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  applyTheme(systemPrefersDark() ? 'dark' : 'light');
  window.dispatchEvent(new Event('kb-theme-change'));
}

/**
 * Applies the initial theme immediately (call once, before React renders,
 * to avoid a flash of the wrong theme) and keeps it in sync with OS-level
 * theme changes for as long as the user hasn't picked an explicit override.
 * Returns an unsubscribe function for cleanup.
 */
export function initTheme(): () => void {
  applyTheme(getInitialTheme());

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = (event: MediaQueryListEvent) => {
    if (getStoredTheme() === null) {
      applyTheme(event.matches ? 'dark' : 'light');
    }
  };

  mediaQuery.addEventListener('change', handleChange);
  return () => mediaQuery.removeEventListener('change', handleChange);
}
