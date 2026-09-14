import type { SearchEntry, Topic } from '../types';
import { normalize } from './normalize';

export interface PaletteAction {
  id: string;
  label: string;
}

const TOPIC_RESULT_LIMIT = 8;

export function buildActionList(): PaletteAction[] {
  return [
    { id: 'home', label: 'בית' },
    { id: 'flashcards', label: 'כרטיסיות' },
    { id: 'quiz', label: 'מבחן' },
    { id: 'map', label: 'מפת ידע' },
    { id: 'settings', label: 'הגדרות' },
    { id: 'toggle-theme', label: 'החלף ערכת נושא' },
  ];
}

/**
 * Title matches come first; when there is room left, topics whose
 * definition (search index) or the user's own note mentions the query are
 * appended — the header's search control promises "נושא, הגדרה או הערה".
 */
export function filterResults(
  query: string,
  actions: PaletteAction[],
  topics: Topic[],
  searchIndex: SearchEntry[] = [],
  notes?: Map<string, string>,
): { actions: PaletteAction[]; topics: Topic[] } {
  const normalizedQuery = normalize(query);
  if (normalizedQuery === '') {
    return { actions, topics: [] };
  }
  const matchedActions = actions.filter((action) => normalize(action.label).includes(normalizedQuery));

  const matchedTopics: Topic[] = [];
  const seen = new Set<string>();
  for (const topic of topics) {
    if (normalize(topic.title).includes(normalizedQuery)) {
      matchedTopics.push(topic);
      seen.add(topic.id);
      if (matchedTopics.length >= TOPIC_RESULT_LIMIT) return { actions: matchedActions, topics: matchedTopics };
    }
  }

  const secondaryIds = new Set<string>();
  for (const entry of searchIndex) {
    if (!seen.has(entry.id) && entry.search.includes(normalizedQuery)) secondaryIds.add(entry.id);
  }
  if (notes) {
    for (const [topicId, text] of notes) {
      if (!seen.has(topicId) && normalize(text).includes(normalizedQuery)) secondaryIds.add(topicId);
    }
  }
  if (secondaryIds.size > 0) {
    for (const topic of topics) {
      if (!secondaryIds.has(topic.id)) continue;
      matchedTopics.push(topic);
      if (matchedTopics.length >= TOPIC_RESULT_LIMIT) break;
    }
  }
  return { actions: matchedActions, topics: matchedTopics };
}
