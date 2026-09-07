import { describe, expect, it } from 'vitest';
import { buildDistractors, buildQuestion, buildQuiz } from './quiz';
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

const allTopics: Topic[] = [
  topic({ id: 'a', category: 'concepts', title: 'A' }),
  topic({ id: 'b', category: 'concepts', title: 'B' }),
  topic({ id: 'c', category: 'concepts', title: 'C' }),
  topic({ id: 'd', category: 'concepts', title: 'D' }),
  topic({ id: 'e', category: 'algorithms', title: 'E' }),
];

describe('buildDistractors', () => {
  it('picks the requested count from the same category, excluding the topic itself', () => {
    const target = allTopics[0]; // 'a', concepts
    const distractors = buildDistractors(target, allTopics, 3);
    expect(distractors).toHaveLength(3);
    expect(distractors.every((t) => t.category === 'concepts')).toBe(true);
    expect(distractors.some((t) => t.id === 'a')).toBe(false);
  });

  it('never includes duplicate topics', () => {
    const target = allTopics[0];
    const distractors = buildDistractors(target, allTopics, 3);
    const ids = distractors.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns fewer than requested if the category does not have enough other topics', () => {
    const target = allTopics[4]; // 'e', algorithms — the only topic in that category here
    const distractors = buildDistractors(target, allTopics, 3);
    expect(distractors).toHaveLength(0);
  });
});

describe('buildQuestion', () => {
  it('includes the correct title exactly once among 4 options', () => {
    const target = allTopics[0];
    const question = buildQuestion(target, allTopics);
    expect(question.topicId).toBe('a');
    expect(question.definition).toBe(target.definition);
    expect(question.correctTitle).toBe('A');
    expect(question.options).toHaveLength(4);
    expect(question.options.filter((o) => o === 'A')).toHaveLength(1);
    expect(new Set(question.options).size).toBe(4);
  });
});

describe('buildQuiz', () => {
  it('builds one question per candidate, up to the requested count', () => {
    const questions = buildQuiz(allTopics, allTopics, 3);
    expect(questions).toHaveLength(3);
    const ids = questions.map((q) => q.topicId);
    expect(new Set(ids).size).toBe(3);
  });

  it('clamps to the candidate pool size when count exceeds it', () => {
    const questions = buildQuiz(allTopics, allTopics, 100);
    expect(questions).toHaveLength(allTopics.length);
  });

  it('returns an empty array for an empty candidate pool', () => {
    expect(buildQuiz([], allTopics, 5)).toEqual([]);
  });
});
