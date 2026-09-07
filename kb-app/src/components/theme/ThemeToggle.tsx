import { useEffect, useState } from 'react';
import { getCurrentTheme, setTheme } from '../../lib/theme';

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(getCurrentTheme);

  // Keeps this button's own displayed state in sync with theme changes made
  // from elsewhere (e.g. the command palette's "toggle theme" action calls
  // setTheme() directly) — the same kb-theme-change event Map.tsx already
  // listens for to re-resolve its canvas colors.
  useEffect(() => {
    function handleThemeChange() {
      setThemeState(getCurrentTheme());
    }
    window.addEventListener('kb-theme-change', handleThemeChange);
    return () => window.removeEventListener('kb-theme-change', handleThemeChange);
  }, []);

  function toggle() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'עבור לערכת נושא בהירה' : 'עבור לערכת נושא כהה'}
      className="grid size-11 place-items-center rounded-full border border-[var(--kb-border)] bg-[var(--kb-surface)] text-base transition hover:bg-[var(--kb-surface2)]"
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}
