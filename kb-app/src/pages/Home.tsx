import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import searchIndexRaw from '../data/search-index.json';
import type { ModulesMap, SearchEntry, Topic } from '../types';
import { filterTopics } from '../lib/filterTopics';
import { groupTopicsByModule } from '../lib/groupTopics';
import { ALL_STATUSES, STATUS_LABELS } from '../lib/progressStatus';
import { getDueStats } from '../lib/srs';
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useUiStore } from '../store/uiStore';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MobileDrawer from '../components/layout/MobileDrawer';
import TabBar from '../components/layout/TabBar';
import ShortcutsHelp from '../components/layout/ShortcutsHelp';
import DashboardCard from '../components/home/DashboardCard';
import ModuleChips from '../components/home/ModuleChips';
import SearchBar from '../components/browse/SearchBar';
import FilterChips from '../components/browse/FilterChips';
import SortMenu from '../components/browse/SortMenu';
import AccordionGroup from '../components/browse/AccordionGroup';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const searchIndex = searchIndexRaw as SearchEntry[];
const topicsById = new Map(topics.map((topic) => [topic.id, topic]));

const categoryLabels: Record<string, string> = Object.fromEntries(
  topics.map((topic) => [topic.category, topic.category_label]),
);
const moduleCounts: Record<string, number> = Object.fromEntries(
  Object.keys(modules).map((key) => [key, topics.filter((topic) => topic.module === key).length]),
);
const categoryCounts: Record<string, number> = Object.fromEntries(
  Object.keys(categoryLabels).map((key) => [key, topics.filter((topic) => topic.category === key).length]),
);

const statusChipClass =
  'flex min-h-10 items-center rounded-full border px-3 text-[13px] transition-colors aria-pressed:border-[var(--kb-accent-soft)] aria-pressed:bg-[var(--kb-accent-soft)] aria-pressed:font-semibold aria-pressed:text-[var(--kb-accent)] border-[var(--kb-border)] bg-[var(--kb-surface)] font-medium text-[var(--kb-text2)] hover:bg-[var(--kb-surface2)]';

export default function Home() {
  const navigate = useNavigate();
  const searchQuery = useUiStore((s) => s.searchQuery);
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const selectedStatuses = useUiStore((s) => s.selectedStatuses);
  const toggleStatus = useUiStore((s) => s.toggleStatus);
  const includeNotesInSearch = useUiStore((s) => s.includeNotesInSearch);
  const toggleIncludeNotesInSearch = useUiStore((s) => s.toggleIncludeNotesInSearch);
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

  const { moduleMasteredCounts, masteredCount, learningCount } = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(Object.keys(modules).map((key) => [key, 0]));
    let mastered = 0;
    let learning = 0;
    for (const t of topics) {
      const status = progress.get(t.id);
      if (status === 'learning') learning += 1;
      if (status !== 'mastered') continue;
      counts[t.module] = (counts[t.module] ?? 0) + 1;
      mastered += 1;
    }
    return { moduleMasteredCounts: counts, masteredCount: mastered, learningCount: learning };
  }, [progress]);

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

  const sidebar = (
    <Sidebar
      modules={modules}
      moduleCounts={moduleCounts}
      moduleMasteredCounts={moduleMasteredCounts}
      categoryLabels={categoryLabels}
      categoryCounts={categoryCounts}
      topicsById={topicsById}
    />
  );

  return (
    <>
      <Header />
      <div className="mx-auto flex max-w-[1440px] items-start pb-20 md:pb-0">
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
              <button type="button" onClick={expandAllGroups} className="min-h-9 font-medium text-[var(--kb-accent)] hover:underline">
                הרחב הכול
              </button>
              <button type="button" onClick={collapseAllGroups} className="min-h-9 font-medium text-[var(--kb-accent)] hover:underline">
                כווץ הכול
              </button>
            </div>
            {groups.length === 0 && <p className="text-[var(--kb-muted)]">לא נמצאו נושאים.</p>}
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
        <aside className="sticky top-16 hidden max-h-[calc(100vh-4rem)] w-72 shrink-0 overflow-y-auto border-s border-[var(--kb-border)] bg-[var(--kb-surface)] md:block">
          {sidebar}
        </aside>
      </div>
      <MobileDrawer title="סינון וניווט">{sidebar}</MobileDrawer>
      <TabBar dueCount={dueStats.dueCount} />
      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
