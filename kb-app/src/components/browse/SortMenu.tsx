import type { SortOrder } from '../../types';
import { useUiStore } from '../../store/uiStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'original', label: 'מקורי' },
  { value: 'alpha', label: 'א־ת' },
  { value: 'category', label: 'קטגוריה' },
];

export default function SortMenu() {
  const sortOrder = useUiStore((s) => s.sortOrder);
  const setSortOrder = useUiStore((s) => s.setSortOrder);

  return (
    <div className="flex items-center gap-2 text-sm text-[var(--kb-text)]">
      <span>מיון:</span>
      <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
        <SelectTrigger aria-label="מיין נושאים לפי" className="min-h-11 min-w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
