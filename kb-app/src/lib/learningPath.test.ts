import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProgressStatus, Topic } from '../types';
import {
  buildLearningPath,
  getFirstUnmasteredTopic,
  getModulePathProgress,
  getPathPrevNext,
  isModuleComplete,
} from './learningPath';

function t(id: string, module: string, num: number, title = id): Topic {
  return {
    id,
    module,
    module_label: module,
    category: 'concepts',
    category_label: 'מושגים',
    num,
    slug_name: id,
    title,
    definition: '',
    related_raw: [],
    related_match: [],
    contentPath: `/topic-content/${id}.html`,
  };
}

const intro2 = t('intro-2', 'Intro to Data Science', 2);
const intro1 = t('intro-1', 'Intro to Data Science', 1);
const unsup1 = t('unsup-1', 'Topic 1 - Unsupervised Learning', 1);
const unsup2 = t('unsup-2', 'Topic 1 - Unsupervised Learning', 2);
// Fed out of module and num order on purpose, matching the real dataset's
// raw JSON (verified NOT to already be module/num-sorted).
const scrambled = [unsup2, intro2, unsup1, intro1];

describe('buildLearningPath', () => {
  it('sorts by module order, then ascending num within a module', () => {
    expect(buildLearningPath(scrambled)).toEqual([intro1, intro2, unsup1, unsup2]);
  });

  it('breaks an equal-num tie by title', () => {
    const b = t('b', 'Intro to Data Science', 1, 'B');
    const a = t('a', 'Intro to Data Science', 1, 'A');
    expect(buildLearningPath([b, a])).toEqual([a, b]);
  });

  it('pushes an unrecognized module to the end and warns instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stray = t('stray', 'Some Future Module', 1);
    expect(buildLearningPath([intro1, stray])).toEqual([intro1, stray]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Some Future Module'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

describe('getPathPrevNext', () => {
  it('crosses from the end of one module into the start of the next', () => {
    expect(getPathPrevNext(intro2, scrambled)).toEqual({ prev: intro1, next: unsup1 });
  });

  it('returns null prev at the very start of the path', () => {
    expect(getPathPrevNext(intro1, scrambled).prev).toBeNull();
  });

  it('returns null next at the very end of the path', () => {
    expect(getPathPrevNext(unsup2, scrambled).next).toBeNull();
  });

  it('returns null/null for a topic not present in the given set', () => {
    const stranger = t('stranger', 'Intro to Data Science', 9);
    expect(getPathPrevNext(stranger, scrambled)).toEqual({ prev: null, next: null });
  });
});

describe('getFirstUnmasteredTopic', () => {
  const path = buildLearningPath(scrambled);

  it('returns the first topic in path order when nothing is mastered', () => {
    expect(getFirstUnmasteredTopic(new Map(), path)).toEqual(intro1);
  });

  it('skips mastered topics and returns the first one that is not', () => {
    const progress = new Map<string, ProgressStatus>([[intro1.id, 'mastered'], [intro2.id, 'mastered']]);
    expect(getFirstUnmasteredTopic(progress, path)).toEqual(unsup1);
  });

  it('returns null once every topic is mastered', () => {
    const progress = new Map<string, ProgressStatus>(path.map((topic) => [topic.id, 'mastered']));
    expect(getFirstUnmasteredTopic(progress, path)).toBeNull();
  });
});

describe('getModulePathProgress', () => {
  it('groups topics by module in path order with a per-module mastered count', () => {
    const path = buildLearningPath(scrambled);
    const progress = new Map<string, ProgressStatus>([[intro1.id, 'mastered']]);
    expect(getModulePathProgress(progress, path)).toEqual([
      { moduleKey: 'Intro to Data Science', moduleLabel: 'Intro to Data Science', topics: [intro1, intro2], masteredCount: 1 },
      {
        moduleKey: 'Topic 1 - Unsupervised Learning',
        moduleLabel: 'Topic 1 - Unsupervised Learning',
        topics: [unsup1, unsup2],
        masteredCount: 0,
      },
    ]);
  });
});

describe('isModuleComplete', () => {
  const path = buildLearningPath(scrambled);

  it('is false until every topic in the module is mastered', () => {
    const progress = new Map<string, ProgressStatus>([[intro1.id, 'mastered']]);
    expect(isModuleComplete(intro1, progress, path)).toBe(false);
  });

  it('is true once every topic in the module (and only that module) is mastered', () => {
    const progress = new Map<string, ProgressStatus>([[intro1.id, 'mastered'], [intro2.id, 'mastered']]);
    expect(isModuleComplete(intro1, progress, path)).toBe(true);
    expect(isModuleComplete(unsup1, progress, path)).toBe(false);
  });
});
