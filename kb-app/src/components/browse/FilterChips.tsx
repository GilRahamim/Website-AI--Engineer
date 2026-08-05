import type { ModulesMap } from '../../types';
import { useUiStore } from '../../store/uiStore';

interface FilterChipsProps {
  modules: ModulesMap;
  categoryLabels: Record<string, string>;
}

export default function FilterChips({ modules, categoryLabels }: FilterChipsProps) {
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const toggleModule = useUiStore((s) => s.toggleModule);
  const toggleCategory = useUiStore((s) => s.toggleCategory);
  const clearFilters = useUiStore((s) => s.clearFilters);

  const chips = [
    ...[...selectedModules].map((key) => ({ kind: 'module' as const, key, label: modules[key] ?? key })),
    ...[...selectedCategories].map((key) => ({
      kind: 'category' as const,
      key,
      label: categoryLabels[key] ?? key,
    })),
  ];

  if (chips.length === 0) return null;

  return (
    <div role="list" aria-label="סינון פעיל" className="flex flex-wrap gap-2 py-2">
      {chips.map((chip) => (
        <button
          key={`${chip.kind}-${chip.key}`}
          type="button"
          role="listitem"
          onClick={() => (chip.kind === 'module' ? toggleModule(chip.key) : toggleCategory(chip.key))}
          className="flex min-h-11 items-center gap-1 rounded-full bg-[var(--kb-accent-soft)] px-3 text-sm text-[var(--kb-text)]"
        >
          {chip.label} <span aria-hidden="true">✕</span>
        </button>
      ))}
      <button
        type="button"
        onClick={clearFilters}
        className="min-h-11 rounded-full border border-[var(--kb-border-strong)] px-3 text-sm text-[var(--kb-muted)]"
      >
        נקה הכול
      </button>
    </div>
  );
}
