import { normalize } from './normalize';
import type { FilterState, SearchEntry, Topic } from '../types';

export function filterTopics(
  topics: Topic[],
  searchIndex: SearchEntry[],
  filters: FilterState,
): Topic[] {
  const normalizedQuery = normalize(filters.searchQuery);
  const matchedIds = normalizedQuery
    ? new Set(
        searchIndex.filter((entry) => entry.search.includes(normalizedQuery)).map((entry) => entry.id),
      )
    : null;

  const result = topics.filter((topic) => {
    if (matchedIds && !matchedIds.has(topic.id)) return false;
    if (filters.selectedModules.size > 0 && !filters.selectedModules.has(topic.module)) return false;
    if (filters.selectedCategories.size > 0 && !filters.selectedCategories.has(topic.category)) {
      return false;
    }
    return true;
  });

  return sortTopics(result, filters.sortOrder);
}

function sortTopics(topics: Topic[], sortOrder: FilterState['sortOrder']): Topic[] {
  if (sortOrder === 'original') return topics;

  const sorted = [...topics];
  if (sortOrder === 'alpha') {
    sorted.sort((a, b) => a.title.localeCompare(b.title, 'he'));
  } else {
    sorted.sort((a, b) => a.category.localeCompare(b.category, 'he'));
  }
  return sorted;
}
