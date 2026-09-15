import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { getCurrentTheme, setTheme } from '../../lib/theme';
import { Button } from '@/components/ui/button';

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
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'עבור לערכת נושא בהירה' : 'עבור לערכת נושא כהה'}
      className="size-11 rounded-[10px]"
    >
      {theme === 'dark' ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
    </Button>
  );
}
