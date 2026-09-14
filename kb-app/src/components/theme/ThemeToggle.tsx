import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
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
      className="grid size-10 place-items-center rounded-[10px] bg-[var(--kb-surface2)] text-[var(--kb-text2)] transition-colors hover:bg-[var(--kb-border)] hover:text-[var(--kb-text)]"
    >
      {theme === 'dark' ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
    </button>
  );
}
