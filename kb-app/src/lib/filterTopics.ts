import { normalize } from './normalize';
import type { FilterState, ProgressStatus, SearchEntry, Topic } from '../types';

export function filterTopics(
  topics: Topic[],
  searchIndex: SearchEntry[],
  filters: FilterState,
  progress: Map<string, ProgressStatus>,
  notes?: Map<string, string>,
): Topic[] {
  const normalizedQuery = normalize(filters.searchQuery);
  const matchedIds = normalizedQuery
    ? new Set(
        searchIndex.filter((entry) => entry.search.includes(normalizedQuery)).map((entry) => entry.id),
      )
    : null;

  if (matchedIds && notes) {
    for (const [topicId, text] of notes) {
      if (normalize(text).includes(normalizedQuery)) {
        matchedIds.add(topicId);
      }
    }
  }

  const result = topics.filter((topic) => {
    if (matchedIds && !matchedIds.has(topic.id)) return false;
    if (filters.selectedModules.size > 0 && !filters.selectedModules.has(topic.module)) return false;
    if (filters.selectedCategories.size > 0 && !filters.selectedCategories.has(topic.category)) {
      return false;
    }
    if (filters.selectedStatuses.size > 0) {
      const status = progress.get(topic.id) ?? 'new';
      if (!filters.selectedStatuses.has(status)) return false;
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
    sorted.sort((a, b) => {
      const byCategory = a.category_label.localeCompare(b.category_label, 'he');
      return byCategory !== 0 ? byCategory : a.title.localeCompare(b.title, 'he');
    });
  }
  return sorted;
}
