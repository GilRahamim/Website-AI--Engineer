import { describe, expect, it } from 'vitest';
import { filterTopics } from './filterTopics';
import type { FilterState, ProgressStatus, SearchEntry, Topic } from '../types';

function topic(overrides: Partial<Topic>): Topic {
  return {
    id: 'id',
    module: 'Intro to Data Science',
    module_label: 'מבוא',
    category: 'algorithms',
    category_label: 'אלגוריתמים',
    num: 1,
    slug_name: 'slug',
    title: 'Title',
    definition: 'Definition',
    related_raw: [],
    related_match: [],
    contentPath: '/topic-content/x.html',
    ...overrides,
  };
}

const topics: Topic[] = [
  topic({ id: 'a', title: 'Linear Regression', category: 'algorithms', category_label: 'אלגוריתמים', module: 'Intro to Data Science' }),
  topic({ id: 'b', title: 'K-Means Clustering', category: 'algorithms', category_label: 'אלגוריתמים', module: 'Topic 1 - Unsupervised Learning' }),
  topic({ id: 'c', title: 'Bias-Variance Tradeoff', category: 'concepts', category_label: 'מושגים', module: 'Intro to Data Science' }),
  topic({ id: 'd', title: 'Attention Mechanism', category: 'concepts', category_label: 'מושגים', module: 'Topic 3 - Deep Learning' }),
];

const searchIndex: SearchEntry[] = [
  { id: 'a', search: 'linear regression definition text' },
  { id: 'b', search: 'k means clustering definition text' },
  { id: 'c', search: 'bias variance tradeoff definition text' },
  { id: 'd', search: 'attention mechanism definition text' },
];

const noProgress = new Map<string, ProgressStatus>();

function filters(overrides: Partial<FilterState>): FilterState {
  return {
    searchQuery: '',
    selectedModules: new Set(),
    selectedCategories: new Set(),
    selectedStatuses: new Set(),
    sortOrder: 'original',
    ...overrides,
  };
}

describe('filterTopics', () => {
  it('returns all topics in original order with no filters', () => {
    const result = filterTopics(topics, searchIndex, filters({}), noProgress);
    expect(result.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('narrows by search query against the normalized search index', () => {
    const result = filterTopics(topics, searchIndex, filters({ searchQuery: 'k-means' }), noProgress);
    expect(result.map((t) => t.id)).toEqual(['b']);
  });

  it('filters by a single module', () => {
    const result = filterTopics(
      topics,
      searchIndex,
      filters({ selectedModules: new Set(['Intro to Data Science']) }),
      noProgress,
    );
    expect(result.map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('is OR within a filter type (two modules selected)', () => {
    const result = filterTopics(
      topics,
      searchIndex,
      filters({ selectedModules: new Set(['Intro to Data Science', 'Topic 3 - Deep Learning']) }),
      noProgress,
    );
    expect(result.map((t) => t.id)).toEqual(['a', 'c', 'd']);
  });

  it('is AND across filter types (module + category)', () => {
    const result = filterTopics(
      topics,
      searchIndex,
      filters({
        selectedModules: new Set(['Intro to Data Science']),
        selectedCategories: new Set(['concepts']),
      }),
      noProgress,
    );
    expect(result.map((t) => t.id)).toEqual(['c']);
  });

  it('combines search with module/category filters', () => {
    const result = filterTopics(
      topics,
      searchIndex,
      filters({ searchQuery: 'definition', selectedCategories: new Set(['algorithms']) }),
      noProgress,
    );
    expect(result.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('sorts alphabetically (Hebrew-aware localeCompare) when sortOrder is alpha', () => {
    const result = filterTopics(topics, searchIndex, filters({ sortOrder: 'alpha' }), noProgress);
    expect(result.map((t) => t.title)).toEqual([
      'Attention Mechanism',
      'Bias-Variance Tradeoff',
      'K-Means Clustering',
      'Linear Regression',
    ]);
  });

  it('sorts by category label, then title, when sortOrder is category', () => {
    const result = filterTopics(topics, searchIndex, filters({ sortOrder: 'category' }), noProgress);
    expect(result.map((t) => t.id)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('returns an empty array when nothing matches', () => {
    const result = filterTopics(topics, searchIndex, filters({ searchQuery: 'nonexistent-term' }), noProgress);
    expect(result).toEqual([]);
  });

  it('filters by a single status, treating topics with no progress record as "new"', () => {
    const progress = new Map<string, ProgressStatus>([['a', 'mastered']]);
    const result = filterTopics(topics, searchIndex, filters({ selectedStatuses: new Set(['mastered']) }), progress);
    expect(result.map((t) => t.id)).toEqual(['a']);
  });

  it('is OR within selected statuses', () => {
    const progress = new Map<string, ProgressStatus>([
      ['a', 'mastered'],
      ['b', 'learning'],
    ]);
    const result = filterTopics(
      topics,
      searchIndex,
      filters({ selectedStatuses: new Set(['mastered', 'learning']) }),
      progress,
    );
    expect(result.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('matches topics with no progress record when "new" is selected', () => {
    const progress = new Map<string, ProgressStatus>([['a', 'mastered']]);
    const result = filterTopics(topics, searchIndex, filters({ selectedStatuses: new Set(['new']) }), progress);
    expect(result.map((t) => t.id)).toEqual(['b', 'c', 'd']);
  });

  it('combines a status filter with module/category filters', () => {
    const progress = new Map<string, ProgressStatus>([['c', 'mastered']]);
    const result = filterTopics(
      topics,
      searchIndex,
      filters({ selectedCategories: new Set(['concepts']), selectedStatuses: new Set(['mastered']) }),
      progress,
    );
    expect(result.map((t) => t.id)).toEqual(['c']);
  });
});
