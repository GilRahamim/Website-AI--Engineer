const STORAGE_KEY = 'kb-theme';

export type Theme = 'light' | 'dark';

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

export function getInitialTheme(): Theme {
  return getStoredTheme() ?? (systemPrefersDark() ? 'dark' : 'light');
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
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
