import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Download, SlidersHorizontal } from 'lucide-react';
import { categoryCounts, categoryLabels, moduleCounts, modules, topics, topicsById } from '../../lib/catalog';
import { getDueStats } from '../../lib/srs';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { useModuleMasteredCounts } from '../../hooks/useModuleMasteredCounts';
import { useUiStore } from '../../store/uiStore';
import { useUserDataStore } from '../../store/userDataStore';
import MobileDrawer from './MobileDrawer';
import Sidebar from './Sidebar';
import TabBar from './TabBar';

const quickLinkClass =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-[var(--kb-text)] no-underline hover:bg-[var(--kb-surface2)]';

/**
 * Phone chrome shared by every route: the bottom tab bar and the slide-in
 * drawer the header's menu button opens. Mounted once in App so the menu
 * button and bottom navigation work identically on the reader, flashcards,
 * quiz, map and settings pages, not only on Home. The drawer shows the Home
 * filters only while Home is on screen; elsewhere it offers quick links,
 * favorites and recently viewed topics.
 */
export default function AppChrome() {
  const { pathname } = useLocation();
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);
  const srsCards = useUserDataStore((s) => s.srsCards);
  const [now] = useState(() => Date.now());
  const { dueCount } = getDueStats(topics, srsCards, now);
  const { moduleMasteredCounts } = useModuleMasteredCounts();
  const { canInstall, promptInstall } = useInstallPrompt();
  const isHome = pathname === '/';

  // A navigation from inside the drawer (favorites, recents, quick links)
  // must close it, and the flag must never leak into the next page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, setDrawerOpen]);

  return (
    <>
      <MobileDrawer title={isHome ? 'סינון וניווט' : 'ניווט'}>
        <nav aria-label="קישורים מהירים" className="border-b border-[var(--kb-border)] p-4">
          <ul className="flex flex-col gap-0.5">
            <li>
              <Link to="/settings" className={quickLinkClass}>
                <SlidersHorizontal aria-hidden="true" size={16} className="shrink-0 text-[var(--kb-accent)]" />
                הגדרות
              </Link>
            </li>
            {canInstall && (
              <li>
                <button type="button" onClick={promptInstall} className={quickLinkClass}>
                  <Download aria-hidden="true" size={16} className="shrink-0 text-[var(--kb-accent)]" />
                  התקן אפליקציה
                </button>
              </li>
            )}
          </ul>
        </nav>
        <Sidebar
          modules={modules}
          moduleCounts={moduleCounts}
          moduleMasteredCounts={moduleMasteredCounts}
          categoryLabels={categoryLabels}
          categoryCounts={categoryCounts}
          topicsById={topicsById}
          showFilters={isHome}
        />
      </MobileDrawer>
      <TabBar dueCount={dueCount} />
    </>
  );
}
