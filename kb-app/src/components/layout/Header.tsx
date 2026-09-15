import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Download, Menu, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { topics } from '../../lib/catalog';
import { getDueStats } from '../../lib/srs';
import { useUserDataStore } from '../../store/userDataStore';
import { useUiStore } from '../../store/uiStore';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import ThemeToggle from '../theme/ThemeToggle';
import { Button } from '@/components/ui/button';

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/', label: 'בית' },
  { to: '/flashcards', label: 'כרטיסיות' },
  { to: '/quiz', label: 'מבחן' },
  { to: '/map', label: 'מפה' },
];

export default function Header() {
  const srsCards = useUserDataStore((s) => s.srsCards);
  const [now] = useState(() => Date.now());
  const { dueCount } = getDueStats(topics, srsCards, now);
  const { canInstall, promptInstall } = useInstallPrompt();
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);
  const readingTopic = useLocation().pathname.startsWith('/topic/');

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--kb-border)] bg-[var(--kb-surface)] shadow-[var(--kb-shadow-sm)]">
      <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setDrawerOpen(true)}
            aria-label="פתח תפריט"
            aria-expanded={drawerOpen}
            className="size-11 rounded-[10px] md:hidden"
          >
            <Menu aria-hidden="true" size={20} />
          </Button>
          <Link to="/" className="flex items-center gap-2.5 text-[var(--kb-text)] no-underline">
          <span className="grid size-9 place-items-center rounded-[10px] bg-[var(--kb-accent-soft)] text-[var(--kb-accent)]">
            <Sparkles aria-hidden="true" size={18} />
          </span>
          <strong className="text-lg font-extrabold max-sm:sr-only">AI Engineer</strong>
        </Link>
        </div>

        <nav aria-label="ניווט ראשי" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              aria-current={item.to === '/' && readingTopic ? 'page' : undefined}
              className={({ isActive }) =>
                `flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm no-underline transition-colors ${
                  isActive || (item.to === '/' && readingTopic)
                    ? 'bg-[var(--kb-accent-soft)] font-semibold text-[var(--kb-accent)]'
                    : 'font-medium text-[var(--kb-text2)] hover:bg-[var(--kb-surface2)] hover:text-[var(--kb-text)]'
                }`
              }
            >
              {item.label}
              {item.to === '/flashcards' && dueCount > 0 && (
                <span
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--kb-accent)] px-1.5 text-[11px] font-bold text-[var(--kb-on-accent)]"
                  aria-label={`${dueCount} כרטיסים ממתינים לחזרה`}
                >
                  {dueCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => window.dispatchEvent(new Event('kb-open-palette'))}
            aria-label="חיפוש מהיר (Ctrl+K)"
            className="flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm text-[var(--kb-muted)] lg:w-64"
          >
            <Search aria-hidden="true" size={18} />
            <span className="hidden min-w-0 flex-1 truncate text-start lg:inline">חפש נושא, הגדרה או הערה…</span>
            <kbd
              aria-hidden="true"
              className="hidden rounded border border-[var(--kb-border)] bg-[var(--kb-surface)] px-1.5 py-0.5 font-mono text-[11px] lg:inline"
            >
              Ctrl K
            </kbd>
          </Button>
          <ThemeToggle />
          <Button variant="secondary" size="icon" asChild className="size-11 rounded-[10px]">
            <Link to="/settings" aria-label="הגדרות" title="הגדרות">
              <SlidersHorizontal aria-hidden="true" size={18} />
            </Link>
          </Button>
          {canInstall && (
            <Button
              type="button"
              variant="outline"
              onClick={promptInstall}
              className="hidden items-center gap-2 rounded-[10px] px-3 text-sm font-semibold sm:flex"
            >
              <Download aria-hidden="true" size={16} />
              התקן אפליקציה
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
