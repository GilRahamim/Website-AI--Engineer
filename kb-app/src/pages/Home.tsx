import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import searchIndexRaw from '../data/search-index.json';
import type { ModulesMap, SearchEntry, Topic } from '../types';
import { filterTopics } from '../lib/filterTopics';
import { groupTopicsByModule } from '../lib/groupTopics';
import { ALL_STATUSES, STATUS_GLYPHS, STATUS_LABELS } from '../lib/progressStatus';
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav';
import { useUiStore } from '../store/uiStore';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';
import Hero from '../components/layout/Hero';
import Sidebar from '../components/layout/Sidebar';
import ShortcutsHelp from '../components/layout/ShortcutsHelp';
import SearchBar from '../components/browse/SearchBar';
import FilterChips from '../components/browse/FilterChips';
import SortMenu from '../components/browse/SortMenu';
import ViewToggle from '../components/browse/ViewToggle';
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

export default function Home() {
  const navigate = useNavigate();
  const searchQuery = useUiStore((s) => s.searchQuery);
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const selectedStatuses = useUiStore((s) => s.selectedStatuses);
  const toggleStatus = useUiStore((s) => s.toggleStatus);
  const sortOrder = useUiStore((s) => s.sortOrder);
  const viewMode = useUiStore((s) => s.viewMode);
  const expandedGroups = useUiStore((s) => s.expandedGroups);
  const toggleGroup = useUiStore((s) => s.toggleGroup);
  const expandAllGroups = useUiStore((s) => s.expandAllGroups);
  const collapseAllGroups = useUiStore((s) => s.collapseAllGroups);
  const progress = useUserDataStore((s) => s.progress);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const { moduleMasteredCounts, masteredCount } = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(Object.keys(modules).map((key) => [key, 0]));
    let total = 0;
    for (const t of topics) {
      if (progress.get(t.id) !== 'mastered') continue;
      counts[t.module] = (counts[t.module] ?? 0) + 1;
      total += 1;
    }
    return { moduleMasteredCounts: counts, masteredCount: total };
  }, [progress]);

  const filtered = useMemo(
    () =>
      filterTopics(
        topics,
        searchIndex,
        { searchQuery, selectedModules, selectedCategories, selectedStatuses, sortOrder },
        progress,
      ),
    [searchQuery, selectedModules, selectedCategories, selectedStatuses, sortOrder, progress],
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

  return (
    <>
      <Header />
      <Hero topicCount={topics.length} moduleCount={Object.keys(modules).length} masteredCount={masteredCount} />
      <div className="flex flex-col md:flex-row">
        <Sidebar
          modules={modules}
          moduleCounts={moduleCounts}
          moduleMasteredCounts={moduleMasteredCounts}
          categoryLabels={categoryLabels}
          categoryCounts={categoryCounts}
          topicsById={topicsById}
        />
        <main className="flex-1 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar />
            <div className="flex gap-1" role="group" aria-label="סינון לפי מצב למידה">
              {ALL_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={selectedStatuses.has(status)}
                  onClick={() => toggleStatus(status)}
                  className="flex min-h-11 items-center gap-1 rounded-full border border-[var(--kb-border)] px-3 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] aria-pressed:bg-[var(--kb-accent-soft)]"
                >
                  <span aria-hidden="true">{STATUS_GLYPHS[status]}</span>
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
            <SortMenu />
            <ViewToggle />
          </div>
          <FilterChips modules={modules} categoryLabels={categoryLabels} />
          <div className="mb-4 flex gap-2 text-sm">
            <button type="button" onClick={expandAllGroups} className="min-h-11 text-[var(--kb-accent)] underline">
              הרחב הכול
            </button>
            <button type="button" onClick={collapseAllGroups} className="min-h-11 text-[var(--kb-accent)] underline">
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
              viewMode={viewMode}
              highlightTerm={searchQuery}
              getItemProps={getItemProps}
            />
          ))}
        </main>
      </div>
      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
