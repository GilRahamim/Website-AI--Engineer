import { useState } from 'react';
import { setTheme, type Theme } from '../../lib/theme';

function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(currentTheme);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
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
