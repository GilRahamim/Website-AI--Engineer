import { describe, expect, it } from 'vitest';
import { buildGraphData } from './graph';
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
  topic({ id: 'a', module: 'm1', category: 'concepts', title: 'A', related_match: ['b', 'c'] }),
  topic({ id: 'b', module: 'm1', category: 'algorithms', title: 'B', related_match: ['a'] }),
  topic({ id: 'c', module: 'm2', category: 'concepts', title: 'C', related_match: ['a', null] }),
  topic({ id: 'd', module: 'm2', category: 'metrics', title: 'D', related_match: [] }),
];

describe('buildGraphData', () => {
  it('includes all topics as nodes when no filter is applied', () => {
    const { nodes } = buildGraphData(topics, 'all', 'all');
    expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('filters nodes by module', () => {
    const { nodes } = buildGraphData(topics, 'm1', 'all');
    expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('filters nodes by category', () => {
    const { nodes } = buildGraphData(topics, 'all', 'concepts');
    expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'c']);
  });

  it('deduplicates a symmetric A<->B relationship into one link', () => {
    const { links } = buildGraphData(topics, 'all', 'all');
    const abLinks = links.filter(
      (l) => (l.source === 'a' && l.target === 'b') || (l.source === 'b' && l.target === 'a'),
    );
    expect(abLinks).toHaveLength(1);
  });

  it('drops a link when the related topic is filtered out', () => {
    const { links } = buildGraphData(topics, 'm1', 'all'); // only a, b visible
    const acLinks = links.filter(
      (l) => (l.source === 'a' && l.target === 'c') || (l.source === 'c' && l.target === 'a'),
    );
    expect(acLinks).toHaveLength(0);
  });

  it('ignores null entries in related_match', () => {
    const { links } = buildGraphData(topics, 'all', 'all');
    expect(links.every((l) => l.source !== null && l.target !== null)).toBe(true);
  });

  it('produces zero links for a topic with no related topics', () => {
    const { links } = buildGraphData([topics[3]], 'all', 'all');
    expect(links).toEqual([]);
  });
});
