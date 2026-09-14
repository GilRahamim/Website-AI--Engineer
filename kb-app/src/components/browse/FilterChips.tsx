import { X } from 'lucide-react';
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
    <div className="flex flex-wrap items-center gap-2 py-1">
      <ul aria-label="סינון פעיל" className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={`${chip.kind}-${chip.key}`}>
            <button
              type="button"
              onClick={() => removeChip(chip)}
              aria-label={`הסר סינון: ${chip.label}`}
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--kb-accent-soft)] px-3 text-[13px] font-medium text-[var(--kb-accent)] hover:opacity-90"
            >
              {chip.label}
              <X aria-hidden="true" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={clearFilters}
        className="min-h-10 rounded-full border border-[var(--kb-border-strong)] px-3 text-[13px] font-medium text-[var(--kb-muted)] hover:bg-[var(--kb-surface2)]"
      >
        נקה הכול
      </button>
    </div>
  );
}
