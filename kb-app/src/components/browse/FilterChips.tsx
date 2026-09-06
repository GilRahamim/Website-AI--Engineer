import type { ModulesMap, ProgressStatus } from '../../types';
import { useUiStore } from '../../store/uiStore';
import { STATUS_LABELS } from '../../lib/progressStatus';

interface FilterChipsProps {
  modules: ModulesMap;
  categoryLabels: Record<string, string>;
}

type Chip =
  | { kind: 'module'; key: string; label: string }
  | { kind: 'category'; key: string; label: string }
  | { kind: 'status'; key: ProgressStatus; label: string };

export default function FilterChips({ modules, categoryLabels }: FilterChipsProps) {
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const selectedStatuses = useUiStore((s) => s.selectedStatuses);
  const toggleModule = useUiStore((s) => s.toggleModule);
  const toggleCategory = useUiStore((s) => s.toggleCategory);
  const toggleStatus = useUiStore((s) => s.toggleStatus);
  const clearFilters = useUiStore((s) => s.clearFilters);

  const chips: Chip[] = [
    ...[...selectedModules].map((key): Chip => ({ kind: 'module', key, label: modules[key] ?? key })),
    ...[...selectedCategories].map((key): Chip => ({ kind: 'category', key, label: categoryLabels[key] ?? key })),
    ...[...selectedStatuses].map((key): Chip => ({ kind: 'status', key, label: STATUS_LABELS[key] })),
  ];

  if (chips.length === 0) return null;

  function removeChip(chip: Chip) {
    if (chip.kind === 'module') toggleModule(chip.key);
    else if (chip.kind === 'category') toggleCategory(chip.key);
    else toggleStatus(chip.key);
  }

  return (
    <div role="list" aria-label="סינון פעיל" className="flex flex-wrap gap-2 py-2">
      {chips.map((chip) => (
        <button
          key={`${chip.kind}-${chip.key}`}
          type="button"
          role="listitem"
          onClick={() => removeChip(chip)}
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
