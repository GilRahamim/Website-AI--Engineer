import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Download, Menu, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import topicsRaw from '../../data/topics.clean.json';
import type { Topic } from '../../types';
import { getDueStats } from '../../lib/srs';
import { useUserDataStore } from '../../store/userDataStore';
import { useUiStore } from '../../store/uiStore';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import ThemeToggle from '../theme/ThemeToggle';

const topics = topicsRaw as Topic[];

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/', label: 'בית' },
  { to: '/flashcards', label: 'כרטיסיות' },
  { to: '/quiz', label: 'מבחן' },
  { to: '/map', label: 'מפה' },
];

const iconButtonClass =
  'grid size-11 place-items-center rounded-[10px] bg-[var(--kb-surface2)] text-[var(--kb-text2)] transition-colors hover:bg-[var(--kb-border)] hover:text-[var(--kb-text)]';

export default function Header() {
  const srsCards = useUserDataStore((s) => s.srsCards);
  const [now] = useState(() => Date.now());
  const { dueCount } = getDueStats(topics, srsCards, now);
  const { canInstall, promptInstall } = useInstallPrompt();
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--kb-border)] bg-[var(--kb-surface)] shadow-[var(--kb-shadow-sm)]">
      <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="פתח תפריט"
            aria-expanded={drawerOpen}
            className={`${iconButtonClass} md:hidden`}
          >
            <Menu aria-hidden="true" size={20} />
          </button>
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
              className={({ isActive }) =>
                `flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm no-underline transition-colors ${
                  isActive
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
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('kb-open-palette'))}
            aria-label="חיפוש מהיר (Ctrl+K)"
            className="flex min-h-11 items-center gap-2 rounded-[10px] bg-[var(--kb-surface2)] px-3 text-sm text-[var(--kb-muted)] transition-colors hover:bg-[var(--kb-border)] hover:text-[var(--kb-text)] lg:w-64"
          >
            <Search aria-hidden="true" size={18} />
            <span className="hidden min-w-0 flex-1 truncate text-start lg:inline">חפש נושא, הגדרה או הערה…</span>
            <kbd
              aria-hidden="true"
              className="hidden rounded border border-[var(--kb-border)] bg-[var(--kb-surface)] px-1.5 py-0.5 font-mono text-[11px] lg:inline"
            >
              Ctrl K
            </kbd>
          </button>
          <ThemeToggle />
          <Link to="/settings" aria-label="הגדרות" title="הגדרות" className={`${iconButtonClass} no-underline`}>
            <SlidersHorizontal aria-hidden="true" size={18} />
          </Link>
          {canInstall && (
            <button
              type="button"
              onClick={promptInstall}
              className="hidden min-h-11 items-center gap-2 rounded-[10px] border border-[var(--kb-border)] bg-[var(--kb-surface)] px-3 text-sm font-semibold text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] sm:flex"
            >
              <Download aria-hidden="true" size={16} />
              התקן אפליקציה
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
