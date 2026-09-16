import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { categoryCounts, categoryLabels, moduleCounts, modules, searchIndex, topics, topicsById } from '../lib/catalog';
import { filterTopics } from '../lib/filterTopics';
import { groupTopicsByModule } from '../lib/groupTopics';
import { ALL_STATUSES, STATUS_LABELS } from '../lib/progressStatus';
import { getDueStats } from '../lib/srs';
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useModuleMasteredCounts } from '../hooks/useModuleMasteredCounts';
import { usePageTitle } from '../hooks/usePageTitle';
import { useUiStore } from '../store/uiStore';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import ShortcutsHelp from '../components/layout/ShortcutsHelp';
import DashboardCard from '../components/home/DashboardCard';
import ModuleChips from '../components/home/ModuleChips';
import SearchBar from '../components/browse/SearchBar';
import FilterChips from '../components/browse/FilterChips';
import SortMenu from '../components/browse/SortMenu';
import AccordionGroup from '../components/browse/AccordionGroup';
import { Button } from '@/components/ui/button';

const statusChipClass =
  'flex min-h-10 items-center rounded-full border px-3 text-[13px] transition-colors aria-pressed:border-[var(--kb-accent-soft)] aria-pressed:bg-[var(--kb-accent-soft)] aria-pressed:font-semibold aria-pressed:text-[var(--kb-accent)] border-[var(--kb-border)] bg-[var(--kb-surface)] font-medium text-[var(--kb-text2)] hover:bg-[var(--kb-surface2)]';

export default function Home() {
  usePageTitle();
  const navigate = useNavigate();
  const searchQuery = useUiStore((s) => s.searchQuery);
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const selectedStatuses = useUiStore((s) => s.selectedStatuses);
  const toggleStatus = useUiStore((s) => s.toggleStatus);
  const includeNotesInSearch = useUiStore((s) => s.includeNotesInSearch);
  const toggleIncludeNotesInSearch = useUiStore((s) => s.toggleIncludeNotesInSearch);
  const clearFilters = useUiStore((s) => s.clearFilters);
  const sortOrder = useUiStore((s) => s.sortOrder);
  const viewMode = useUiStore((s) => s.viewMode);
  const expandedGroups = useUiStore((s) => s.expandedGroups);
  const toggleGroup = useUiStore((s) => s.toggleGroup);
  const expandAllGroups = useUiStore((s) => s.expandAllGroups);
  const collapseAllGroups = useUiStore((s) => s.collapseAllGroups);
  const progress = useUserDataStore((s) => s.progress);
  const notes = useUserDataStore((s) => s.notes);
  const srsCards = useUserDataStore((s) => s.srsCards);
  const recents = useUserDataStore((s) => s.recents);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [now] = useState(() => Date.now());
  const [randomTopic] = useState(() => topics[Math.floor(Math.random() * topics.length)]);
  const dueStats = getDueStats(topics, srsCards, now);
  // Most recently viewed topic; a brand-new user is pointed at the first
  // topic of the course instead so the tile never sits empty.
  const lastViewed = recents.length > 0 ? (topicsById.get(recents[0].topicId) ?? null) : null;
  const continueTopic = lastViewed ?? topics[0];
  const continueLabel = lastViewed ? 'המשך קריאה' : 'התחל כאן';

  // Phones get the compact row layout regardless of the stored grid/list
  // preference — a 3-line card per topic is too tall at 390px.
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const effectiveViewMode = isDesktop ? viewMode : 'list';

  const { moduleMasteredCounts, masteredCount, learningCount } = useModuleMasteredCounts();

  const filtered = useMemo(
    () =>
      filterTopics(
        topics,
        searchIndex,
        { searchQuery, selectedModules, selectedCategories, selectedStatuses, sortOrder },
        progress,
        includeNotesInSearch ? notes : undefined,
      ),
    [searchQuery, selectedModules, selectedCategories, selectedStatuses, sortOrder, progress, includeNotesInSearch, notes],
  );

  const groups = useMemo(() => groupTopicsByModule(filtered, modules), [filtered]);
  const hasActiveFilters =
    searchQuery.trim() !== '' || selectedModules.size > 0 || selectedCategories.size > 0 || selectedStatuses.size > 0;

  const visibleItemIds = useMemo(
    () => groups.filter((group) => expandedGroups.has(group.moduleKey)).flatMap((group) => group.topics.map((t) => t.id)),
    [groups, expandedGroups],
  );

  const { getItemProps } = useGridKeyboardNav(visibleItemIds, (id) => navigate(`/topic/${encodeURIComponent(id)}`));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isTyping = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === '?' && !isTyping) {
        setShortcutsOpen(true);
      }
      if (event.key === 'Escape') {
        setShortcutsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <Header />
      <div className="mx-auto flex max-w-[1440px] items-start">
        <aside className="sticky top-16 hidden max-h-[calc(100vh-4rem)] w-72 shrink-0 overflow-y-auto border-e border-[var(--kb-border)] bg-[var(--kb-surface)] md:block">
          <Sidebar
            modules={modules}
            moduleCounts={moduleCounts}
            moduleMasteredCounts={moduleMasteredCounts}
            categoryLabels={categoryLabels}
            categoryCounts={categoryCounts}
            topicsById={topicsById}
          />
        </aside>
        <div className="min-w-0 flex-1">
          <section aria-label="לוח למידה" className="px-4 pt-4 sm:px-6 lg:px-8">
            <h1 className="sr-only">AI Engineer</h1>
            <DashboardCard
              masteredCount={masteredCount}
              learningCount={learningCount}
              totalCount={topics.length}
              dueCount={dueStats.dueCount}
              newCount={dueStats.newCount}
              reviewedCount={dueStats.reviewedCount}
              randomTopic={randomTopic}
              continueTopic={continueTopic}
              continueLabel={continueLabel}
            />
          </section>
          <main className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <SearchBar />
              <SortMenu />
            </div>
            <div className="md:hidden">
              <ModuleChips modules={modules} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="סינון לפי מצב למידה">
                {ALL_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={selectedStatuses.has(status)}
                    onClick={() => toggleStatus(status)}
                    className={statusChipClass}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
              <label className="flex min-h-10 items-center gap-2 text-[13px] font-medium text-[var(--kb-text2)]">
                <input type="checkbox" checked={includeNotesInSearch} onChange={toggleIncludeNotesInSearch} />
                כלול הערות בחיפוש
              </label>
            </div>
            <FilterChips modules={modules} categoryLabels={categoryLabels} />
            <div className="flex gap-3 text-[13px]">
              <Button type="button" variant="link" onClick={expandAllGroups} className="h-auto min-h-10 p-0 px-1 font-medium">
                הרחב הכול
              </Button>
              <Button type="button" variant="link" onClick={collapseAllGroups} className="h-auto min-h-10 p-0 px-1 font-medium">
                כווץ הכול
              </Button>
            </div>
            {groups.length === 0 && (
              <div
                role="status"
                className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--kb-border-strong)] px-4 py-10 text-center"
              >
                <SearchX aria-hidden="true" size={28} className="text-[var(--kb-muted)]" />
                <p className="font-semibold text-[var(--kb-text)]">לא נמצאו נושאים.</p>
                <p className="text-sm text-[var(--kb-muted)]">נסה מילת חיפוש אחרת או הסר חלק מהסינונים.</p>
                {hasActiveFilters && (
                  <Button type="button" onClick={clearFilters} className="mt-1 min-h-11 rounded-[10px]">
                    נקה סינון והצג הכול
                  </Button>
                )}
              </div>
            )}
            {groups.map((group) => (
              <AccordionGroup
                key={group.moduleKey}
                group={group}
                expanded={expandedGroups.has(group.moduleKey)}
                onToggle={() => toggleGroup(group.moduleKey)}
                viewMode={effectiveViewMode}
                highlightTerm={searchQuery}
                getItemProps={getItemProps}
              />
            ))}
          </main>
        </div>
      </div>
      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
