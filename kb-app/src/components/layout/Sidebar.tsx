import type { ModulesMap } from '../../types';
import { useUiStore } from '../../store/uiStore';

interface SidebarProps {
  modules: ModulesMap;
  moduleCounts: Record<string, number>;
  categoryLabels: Record<string, string>;
  categoryCounts: Record<string, number>;
}

export default function Sidebar({ modules, moduleCounts, categoryLabels, categoryCounts }: SidebarProps) {
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleModule = useUiStore((s) => s.toggleModule);
  const toggleCategory = useUiStore((s) => s.toggleCategory);
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);

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
        <nav aria-label="ניווט מודולים">
          <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">מודולים</h2>
          <ul className="flex flex-col gap-1">
            {Object.entries(modules).map(([key, label]) => (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={selectedModules.has(key)}
                  onClick={() => toggleModule(key)}
                  className="flex min-h-11 w-full items-center justify-between rounded-md px-2 text-start text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] aria-pressed:bg-[var(--kb-accent-soft)]"
                >
                  <span>{label}</span>
                  <span className="text-[var(--kb-muted)]">{moduleCounts[key] ?? 0}</span>
                </button>
              </li>
            ))}
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
