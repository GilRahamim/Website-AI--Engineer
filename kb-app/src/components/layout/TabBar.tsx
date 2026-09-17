import { NavLink, useLocation } from 'react-router-dom';
import { CircleHelp, Home, Layers, Map, Milestone } from 'lucide-react';

interface TabBarProps {
  dueCount: number;
}

const TABS = [
  { to: '/', label: 'בית', Icon: Home },
  { to: '/path', label: 'נתיב', Icon: Milestone },
  { to: '/flashcards', label: 'כרטיסיות', Icon: Layers },
  { to: '/quiz', label: 'מבחן', Icon: CircleHelp },
  { to: '/map', label: 'מפה', Icon: Map },
];

/** Phone-only bottom navigation; the header nav takes over from md up. */
export default function TabBar({ dueCount }: TabBarProps) {
  // Topic pages are reached from Home's catalog, so Home stays the current
  // tab while reading instead of no tab at all.
  const { pathname } = useLocation();
  const readingTopic = pathname.startsWith('/topic/');
  return (
    <nav
      aria-label="ניווט תחתון"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--kb-border)] bg-[var(--kb-surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              aria-current={to === '/' && readingTopic ? 'page' : undefined}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs no-underline ${
                  isActive || (to === '/' && readingTopic) ? 'font-semibold text-[var(--kb-accent)]' : 'font-medium text-[var(--kb-muted)]'
                }`
              }
            >
              <span className="relative">
                <Icon aria-hidden="true" size={22} />
                {to === '/flashcards' && dueCount > 0 && (
                  <span
                    aria-label={`${dueCount} כרטיסים ממתינים לחזרה`}
                    className="absolute -end-2.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--kb-accent)] px-1 text-[11px] font-bold text-[var(--kb-on-accent)]"
                  >
                    {dueCount}
                  </span>
                )}
              </span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
