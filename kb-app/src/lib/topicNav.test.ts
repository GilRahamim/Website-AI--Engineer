import { describe, expect, it } from 'vitest';
import type { Topic } from '../types';
import { estimateReadingMinutes, getModulePosition, getPrevNext } from './topicNav';

function t(id: string, module: string): Topic {
  return {
    id,
    module,
    module_label: module,
    category: 'concepts',
    category_label: 'מושגים',
    num: 0,
    slug_name: id,
    title: id,
    definition: '',
    related_raw: [],
    related_match: [],
    contentPath: `/topic-content/${id}.html`,
  };
}

const topics = [t('a1', 'A'), t('a2', 'A'), t('b1', 'B'), t('a3', 'A')];

describe('getPrevNext', () => {
  it('returns the previous and next topics within the same module, in dataset order', () => {
    expect(getPrevNext(topics[1], topics)).toEqual({ prev: topics[0], next: topics[3] });
  });

  it('returns null prev for the first topic of a module', () => {
    expect(getPrevNext(topics[0], topics).prev).toBeNull();
  });

  it('returns null next for the last topic of a module', () => {
    expect(getPrevNext(topics[3], topics).next).toBeNull();
  });

  it('skips topics from other modules', () => {
    expect(getPrevNext(topics[2], topics)).toEqual({ prev: null, next: null });
  });
});

describe('getModulePosition', () => {
  it('returns the 1-based index and total within the module', () => {
    expect(getModulePosition(topics[3], topics)).toEqual({ index: 3, total: 3 });
  });
});

describe('estimateReadingMinutes', () => {
  it('returns at least 1 minute for short content', () => {
    expect(estimateReadingMinutes('<p>מילה אחת</p>')).toBe(1);
  });

  it('ignores markup and rounds up at 200 words per minute', () => {
    const words = Array.from({ length: 401 }, () => 'מילה').join(' ');
    expect(estimateReadingMinutes(`<h4 class='sec-h'>x</h4><p>${words}</p>`)).toBe(3);
  });
});
