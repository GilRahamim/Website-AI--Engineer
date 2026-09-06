import { Link } from 'react-router-dom';
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
}

export default function Sidebar({
  modules,
  moduleCounts,
  moduleMasteredCounts,
  categoryLabels,
  categoryCounts,
  topicsById,
}: SidebarProps) {
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleModule = useUiStore((s) => s.toggleModule);
  const toggleCategory = useUiStore((s) => s.toggleCategory);
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);
  const favorites = useUserDataStore((s) => s.favorites);
  const recents = useUserDataStore((s) => s.recents);

  const favoriteTopics = [...favorites]
    .map((id) => topicsById.get(id))
    .filter((topic): topic is Topic => topic !== undefined);
  const recentTopics = recents
    .map((entry) => topicsById.get(entry.topicId))
    .filter((topic): topic is Topic => topic !== undefined);

  return (
    <>
      <button
        type="button"
        aria-label="פתח/סגור תפריט"
        aria-expanded={!sidebarCollapsed}
        onClick={toggleSidebarCollapsed}
        className="min-h-11 min-w-11 rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface)] md:hidden"
      >
        <span aria-hidden="true">☰</span>
      </button>
      <aside
        className={`shrink-0 border-e border-[var(--kb-border)] bg-[var(--kb-surface)] p-4 ${
          sidebarCollapsed ? 'hidden md:block md:w-16' : 'block w-full md:w-64'
        }`}
      >
        {favoriteTopics.length > 0 && (
          <nav aria-label="מועדפים" className="mb-6">
            <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">מועדפים</h2>
            <ul className="flex flex-col gap-1">
              {favoriteTopics.map((topic) => (
                <li key={topic.id}>
                  <Link
                    to={`/topic/${encodeURIComponent(topic.id)}`}
                    className="flex min-h-11 items-center rounded-md px-2 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
                  >
                    {topic.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {recentTopics.length > 0 && (
          <nav aria-label="נצפו לאחרונה" className="mb-6">
            <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">נצפו לאחרונה</h2>
            <ul className="flex flex-col gap-1">
              {recentTopics.map((topic) => (
                <li key={topic.id}>
                  <Link
                    to={`/topic/${encodeURIComponent(topic.id)}`}
                    className="flex min-h-11 items-center rounded-md px-2 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
                  >
                    {topic.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <nav aria-label="ניווט מודולים">
          <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">מודולים</h2>
          <ul className="flex flex-col gap-1">
            {Object.entries(modules).map(([key, label]) => {
              const total = moduleCounts[key] ?? 0;
              const mastered = moduleMasteredCounts[key] ?? 0;
              const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-pressed={selectedModules.has(key)}
                    onClick={() => toggleModule(key)}
                    className="flex min-h-11 w-full flex-col justify-center gap-1 rounded-md px-2 py-1 text-start text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] aria-pressed:bg-[var(--kb-accent-soft)]"
                  >
                    <span className="flex w-full items-center justify-between">
                      <span>{label}</span>
                      <span className="text-[var(--kb-muted)]">{total}</span>
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
        <nav aria-label="ניווט קטגוריות" className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">קטגוריות</h2>
          <ul className="flex flex-col gap-1">
            {Object.entries(categoryLabels).map(([key, label]) => (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={selectedCategories.has(key)}
                  onClick={() => toggleCategory(key)}
                  className="flex min-h-11 w-full items-center justify-between rounded-md px-2 text-start text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] aria-pressed:bg-[var(--kb-accent-soft)]"
                >
                  <span>{label}</span>
                  <span className="text-[var(--kb-muted)]">{categoryCounts[key] ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
