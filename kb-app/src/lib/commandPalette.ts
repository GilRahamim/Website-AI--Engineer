import type { Topic } from '../types';
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
    { id: 'toggle-theme', label: 'החלף ערכת נושא' },
  ];
}

export function filterResults(
  query: string,
  actions: PaletteAction[],
  topics: Topic[],
): { actions: PaletteAction[]; topics: Topic[] } {
  const normalizedQuery = normalize(query);
  if (normalizedQuery === '') {
    return { actions, topics: [] };
  }
  const matchedActions = actions.filter((action) => normalize(action.label).includes(normalizedQuery));
  const matchedTopics = topics
    .filter((topic) => normalize(topic.title).includes(normalizedQuery))
    .slice(0, TOPIC_RESULT_LIMIT);
  return { actions: matchedActions, topics: matchedTopics };
}
