import type { ModulesMap } from '../../types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      <div className="flex flex-col gap-1 text-sm text-[var(--kb-text)]">
        <Label htmlFor="topic-filters-module">מודול</Label>
        <Select value={selectedModule} onValueChange={onModuleChange}>
          <SelectTrigger id="topic-filters-module" className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכול</SelectItem>
            {Object.entries(modules).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1 text-sm text-[var(--kb-text)]">
        <Label htmlFor="topic-filters-category">קטגוריה</Label>
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger id="topic-filters-category" className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכול</SelectItem>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
