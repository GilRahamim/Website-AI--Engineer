import { describe, expect, it } from 'vitest';
import { buildActionList, filterResults } from './commandPalette';
import type { Topic } from '../types';

function topic(overrides: Partial<Topic>): Topic {
  return {
    id: 'id',
    module: 'm',
    module_label: 'M',
    category: 'concepts',
    category_label: 'C',
    num: 1,
    slug_name: 'slug',
    title: 'Title',
    definition: 'Definition',
    related_raw: [],
    related_match: [],
    contentPath: '/x.html',
    ...overrides,
  };
}

const topics: Topic[] = [
  topic({ id: 'a', title: 'רגרסיה לוגיסטית' }),
  topic({ id: 'b', title: 'רגרסיה ליניארית' }),
  topic({ id: 'c', title: 'עצי החלטה' }),
];

describe('buildActionList', () => {
  it('returns the six fixed actions', () => {
    const actions = buildActionList();
    expect(actions.map((a) => a.id).sort()).toEqual(['flashcards', 'home', 'map', 'quiz', 'settings', 'toggle-theme']);
  });
});

describe('filterResults', () => {
  const actions = buildActionList();

  it('returns all actions and no topics for an empty query', () => {
    const result = filterResults('', actions, topics);
    expect(result.actions).toEqual(actions);
    expect(result.topics).toEqual([]);
  });

  it('returns all actions and no topics for a whitespace-only query', () => {
    const result = filterResults('   ', actions, topics);
    expect(result.actions).toEqual(actions);
    expect(result.topics).toEqual([]);
  });

  it('matches an action by its label', () => {
    const result = filterResults('כרטיסיות', actions, topics);
    expect(result.actions.map((a) => a.id)).toEqual(['flashcards']);
  });

  it('matches topics by title, normalized and Hebrew-aware', () => {
    const result = filterResults('רגרסיה', actions, topics);
    expect(result.topics.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('matches case-insensitively via normalize', () => {
    const englishTopics: Topic[] = [topic({ id: 'x', title: 'Gradient Descent' })];
    const result = filterResults('GRADIENT', actions, englishTopics);
    expect(result.topics.map((t) => t.id)).toEqual(['x']);
  });

  it('caps topic matches at 8', () => {
    const manyTopics: Topic[] = Array.from({ length: 12 }, (_, i) =>
      topic({ id: `t${i}`, title: `נושא משותף ${i}` }),
    );
    const result = filterResults('נושא משותף', actions, manyTopics);
    expect(result.topics).toHaveLength(8);
  });

  it('returns empty arrays when nothing matches', () => {
    const result = filterResults('zzzzzzz', actions, topics);
    expect(result.actions).toEqual([]);
    expect(result.topics).toEqual([]);
  });
});
