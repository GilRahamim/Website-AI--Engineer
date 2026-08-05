import type { SortOrder } from '../../types';
import { useUiStore } from '../../store/uiStore';

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'original', label: 'מקורי' },
  { value: 'alpha', label: 'א־ת' },
  { value: 'category', label: 'קטגוריה' },
];

export default function SortMenu() {
  const sortOrder = useUiStore((s) => s.sortOrder);
  const setSortOrder = useUiStore((s) => s.setSortOrder);

  return (
    <label className="flex items-center gap-2 text-sm text-[var(--kb-text)]">
      <span>מיון:</span>
      <select
        aria-label="מיין נושאים לפי"
        value={sortOrder}
        onChange={(event) => setSortOrder(event.target.value as SortOrder)}
        className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
