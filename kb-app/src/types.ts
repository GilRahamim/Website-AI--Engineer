export type Category = 'algorithms' | 'concepts' | 'metrics' | 'formulas' | 'architectures';

export interface Topic {
  id: string;
  module: string;
  module_label: string;
  category: Category;
  category_label: string;
  num: number;
  slug_name: string;
  title: string;
  definition: string;
  related_raw: string[];
  related_match: (string | null)[];
  contentPath: string;
}

export interface SearchEntry {
  id: string;
  search: string;
}

export type ModulesMap = Record<string, string>;

export type SortOrder = 'original' | 'alpha' | 'category';
export type ViewMode = 'grid' | 'list';

export interface FilterState {
  searchQuery: string;
  selectedModules: Set<string>;
  selectedCategories: Set<string>;
  sortOrder: SortOrder;
}

export interface TopicGroup {
  moduleKey: string;
  moduleLabel: string;
  topics: Topic[];
}
