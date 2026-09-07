import { describe, expect, it } from 'vitest';
import { buildCategoryLabels } from './categoryLabels';
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

describe('buildCategoryLabels', () => {
  it('maps each distinct category to its label', () => {
    const topics: Topic[] = [
      topic({ category: 'concepts', category_label: 'מושגים' }),
      topic({ category: 'metrics', category_label: 'מדדים' }),
    ];
    expect(buildCategoryLabels(topics)).toEqual({ concepts: 'מושגים', metrics: 'מדדים' });
  });

  it('is last-write-wins for repeated categories, matching Object.fromEntries', () => {
    const topics: Topic[] = [
      topic({ category: 'concepts', category_label: 'A' }),
      topic({ category: 'concepts', category_label: 'B' }),
    ];
    expect(buildCategoryLabels(topics)).toEqual({ concepts: 'B' });
  });

  it('returns an empty object for an empty topic list', () => {
    expect(buildCategoryLabels([])).toEqual({});
  });
});
