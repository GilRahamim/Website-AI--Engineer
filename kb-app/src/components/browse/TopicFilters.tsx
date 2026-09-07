import type { ModulesMap } from '../../types';

interface TopicFiltersProps {
  modules: ModulesMap;
  categoryLabels: Record<string, string>;
  selectedModule: string;
  selectedCategory: string;
  onModuleChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}

export default function TopicFilters({
  modules,
  categoryLabels,
  selectedModule,
  selectedCategory,
  onModuleChange,
  onCategoryChange,
}: TopicFiltersProps) {
  return (
    <>
      <label className="flex flex-col text-sm text-[var(--kb-text)]">
        מודול
        <select
          value={selectedModule}
          onChange={(e) => onModuleChange(e.target.value)}
          className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
        >
          <option value="all">הכול</option>
          {Object.entries(modules).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-sm text-[var(--kb-text)]">
        קטגוריה
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
        >
          <option value="all">הכול</option>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
