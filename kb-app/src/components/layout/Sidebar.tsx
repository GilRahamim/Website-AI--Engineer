import { Link } from 'react-router-dom';
import { BookOpen, Star } from 'lucide-react';
import type { ModulesMap, Topic } from '../../types';
import { useUiStore } from '../../store/uiStore';
import { useUserDataStore } from '../../store/userDataStore';

interface SidebarProps {
  modules: ModulesMap;
  moduleCounts: Record<string, number>;
  moduleMasteredCounts: Record<string, number>;
  categoryLabels: Record<string, string>;
  categoryCounts: Record<string, number>;
  topicsById: Map<string, Topic>;
  /** Module/category filters only make sense while Home is on screen. */
  showFilters?: boolean;
}

const CATEGORY_DOT: Record<string, string> = {
  algorithms: 'var(--kb-cat-algorithms)',
  concepts: 'var(--kb-cat-concepts)',
  metrics: 'var(--kb-cat-metrics)',
  formulas: 'var(--kb-cat-formulas)',
  architectures: 'var(--kb-cat-architectures)',
};

function SectionHeading({ children }: { children: string }) {
  return <h2 className="mb-2 text-xs font-semibold text-[var(--kb-muted)]">{children}</h2>;
}

function TopicLinkList({ label, topics, Icon }: { label: string; topics: Topic[]; Icon: typeof Star }) {
  return (
    <nav aria-label={label}>
      <SectionHeading>{label}</SectionHeading>
      <ul className="flex flex-col gap-0.5">
        {topics.map((topic) => (
          <li key={topic.id}>
            <Link
              to={`/topic/${encodeURIComponent(topic.id)}`}
              className="flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-[var(--kb-text2)] no-underline hover:bg-[var(--kb-surface2)] hover:text-[var(--kb-text)]"
            >
              <Icon aria-hidden="true" size={14} className="shrink-0 text-[var(--kb-accent)]" />
              <span className="truncate">{topic.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Filters and quick links. Pure content — Home decides where it lives: a
 * sticky column from md up, the mobile drawer below that.
 */
export default function Sidebar({
  modules,
  moduleCounts,
  moduleMasteredCounts,
  categoryLabels,
  categoryCounts,
  topicsById,
  showFilters = true,
}: SidebarProps) {
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const toggleModule = useUiStore((s) => s.toggleModule);
  const toggleCategory = useUiStore((s) => s.toggleCategory);
  const favorites = useUserDataStore((s) => s.favorites);
  const recents = useUserDataStore((s) => s.recents);

  const favoriteTopics = [...favorites]
    .map((id) => topicsById.get(id))
    .filter((topic): topic is Topic => topic !== undefined);
  const recentTopics = recents
    .map((entry) => topicsById.get(entry.topicId))
    .filter((topic): topic is Topic => topic !== undefined);

  return (
    <div className="flex flex-col gap-6 p-4">
      {showFilters && (
      <nav aria-label="ניווט מודולים">
        <SectionHeading>מודולים</SectionHeading>
        <ul className="flex flex-col gap-1">
          {Object.entries(modules).map(([key, label]) => {
            const total = moduleCounts[key] ?? 0;
            const mastered = moduleMasteredCounts[key] ?? 0;
            const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;
            const active = selectedModules.has(key);
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleModule(key)}
                  className={`flex min-h-11 w-full flex-col justify-center gap-1.5 rounded-lg px-2.5 py-2 text-start text-sm transition-colors hover:bg-[var(--kb-surface2)] ${
                    active ? 'bg-[var(--kb-accent-soft)] font-semibold text-[var(--kb-accent)]' : 'font-medium text-[var(--kb-text)]'
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">{label}</span>
                    <span className="shrink-0 font-mono text-[11px] text-[var(--kb-muted)]">{`${mastered}/${total}`}</span>
                  </span>
                  <span className="h-1 w-full overflow-hidden rounded-full bg-[var(--kb-border)]" aria-hidden="true">
                    <span className="block h-full rounded-full bg-[var(--kb-accent)]" style={{ width: `${percent}%` }} />
                  </span>
                  <span className="sr-only">{`${mastered} מתוך ${total} נשלטו`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      )}

      {showFilters && (
      <nav aria-label="ניווט קטגוריות">
        <SectionHeading>קטגוריות</SectionHeading>
        <ul className="flex flex-col gap-0.5">
          {Object.entries(categoryLabels).map(([key, label]) => {
            const active = selectedCategories.has(key);
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleCategory(key)}
                  className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-start text-sm transition-colors hover:bg-[var(--kb-surface2)] ${
                    active ? 'bg-[var(--kb-accent-soft)] font-semibold text-[var(--kb-accent)]' : 'font-medium text-[var(--kb-text)]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: CATEGORY_DOT[key] ?? 'var(--kb-muted)' }}
                    />
                    {label}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--kb-muted)]">{categoryCounts[key] ?? 0}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      )}

      {favoriteTopics.length > 0 && <TopicLinkList label="מועדפים" topics={favoriteTopics} Icon={Star} />}
      {recentTopics.length > 0 && <TopicLinkList label="נצפו לאחרונה" topics={recentTopics} Icon={BookOpen} />}
      {!showFilters && favoriteTopics.length === 0 && recentTopics.length === 0 && (
        <p className="text-sm text-[var(--kb-muted)]">נושאים שתסמן במועדפים או תפתח יופיעו כאן לגישה מהירה.</p>
      )}
    </div>
  );
}
