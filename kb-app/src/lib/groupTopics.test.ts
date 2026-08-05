import { describe, expect, it } from 'vitest';
import { groupTopicsByModule } from './groupTopics';
import type { ModulesMap, Topic } from '../types';

function topic(id: string, module: string): Topic {
  return {
    id,
    module,
    module_label: module,
    category: 'algorithms',
    category_label: 'אלגוריתמים',
    num: 1,
    slug_name: id,
    title: id,
    definition: 'def',
    related_raw: [],
    related_match: [],
    contentPath: `/topic-content/${id}.html`,
  };
}

const modules: ModulesMap = {
  'Module A': 'מודול א',
  'Module B': 'מודול ב',
  'Module C': 'מודול ג',
};

describe('groupTopicsByModule', () => {
  it('groups topics under their module, preserving modules.json order', () => {
    const topics = [topic('b1', 'Module B'), topic('a1', 'Module A'), topic('a2', 'Module A')];
    const groups = groupTopicsByModule(topics, modules);

    expect(groups.map((g) => g.moduleKey)).toEqual(['Module A', 'Module B']);
    expect(groups[0].topics.map((t) => t.id)).toEqual(['a1', 'a2']);
    expect(groups[1].topics.map((t) => t.id)).toEqual(['b1']);
  });

  it('preserves the incoming topic order within a group (does not re-sort)', () => {
    const topics = [topic('a2', 'Module A'), topic('a1', 'Module A')];
    const groups = groupTopicsByModule(topics, modules);
    expect(groups[0].topics.map((t) => t.id)).toEqual(['a2', 'a1']);
  });

  it('omits modules with zero matching topics', () => {
    const topics = [topic('a1', 'Module A')];
    const groups = groupTopicsByModule(topics, modules);
    expect(groups.map((g) => g.moduleKey)).toEqual(['Module A']);
  });

  it('returns an empty array when no topics match any module', () => {
    expect(groupTopicsByModule([], modules)).toEqual([]);
  });

  it('carries the module label from the modules map', () => {
    const topics = [topic('a1', 'Module A')];
    const groups = groupTopicsByModule(topics, modules);
    expect(groups[0].moduleLabel).toBe('מודול א');
  });
});
