import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  __resetDbForTests,
  getAllFavorites,
  getAllProgress,
  getAllRecents,
  recordView,
  setProgress,
  toggleFavorite,
} from './db';

beforeEach(() => {
  // Fresh IndexedDB per test — fake-indexeddb otherwise persists across tests
  // in the same file, which would make the "empty by default" assertions flaky.
  // eslint-disable-next-line no-global-assign
  indexedDB = new IDBFactory();
  __resetDbForTests();
});

describe('db — progress', () => {
  it('returns an empty array when nothing is stored', async () => {
    expect(await getAllProgress()).toEqual([]);
  });

  it('setProgress writes a record retrievable via getAllProgress', async () => {
    await setProgress('topic-a', 'learning');
    const all = await getAllProgress();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ topicId: 'topic-a', status: 'learning' });
    expect(all[0].updatedAt).toEqual(expect.any(Number));
  });

  it('setProgress overwrites the existing record for the same topic', async () => {
    await setProgress('topic-a', 'learning');
    await setProgress('topic-a', 'mastered');
    const all = await getAllProgress();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('mastered');
  });
});

describe('db — favorites', () => {
  it('returns an empty array when nothing is favorited', async () => {
    expect(await getAllFavorites()).toEqual([]);
  });

  it('toggleFavorite adds a favorite, then removes it on a second call', async () => {
    await toggleFavorite('topic-a');
    expect(await getAllFavorites()).toHaveLength(1);
    await toggleFavorite('topic-a');
    expect(await getAllFavorites()).toEqual([]);
  });
});

describe('db — recents', () => {
  it('returns an empty array when nothing was viewed', async () => {
    expect(await getAllRecents()).toEqual([]);
  });

  it('recordView upserts one row per topic (no duplicates on repeat views)', async () => {
    await recordView('topic-a');
    await recordView('topic-a');
    const all = await getAllRecents();
    expect(all).toHaveLength(1);
  });

  it('returns at most 12 rows, most recently viewed first', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      for (let i = 0; i < 15; i++) {
        // Sequential writes needed so viewedAt ordering is deterministic
        await recordView(`topic-${i}`);
        vi.advanceTimersByTime(1);
      }
    } finally {
      vi.useRealTimers();
    }
    const all = await getAllRecents();
    expect(all).toHaveLength(12);
    expect(all.map((r) => r.topicId)).toEqual([
      'topic-14', 'topic-13', 'topic-12', 'topic-11', 'topic-10',
      'topic-9', 'topic-8', 'topic-7', 'topic-6', 'topic-5', 'topic-4', 'topic-3',
    ]);
  });
});

describe('db — failure handling', () => {
  it('resolves with safe defaults and warns exactly once when IndexedDB is unavailable', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const originalOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = () => {
      throw new Error('boom');
    };

    expect(await getAllProgress()).toEqual([]);
    await expect(setProgress('topic-a', 'learning')).resolves.toBeUndefined();
    expect(await getAllFavorites()).toEqual([]);
    await expect(toggleFavorite('topic-a')).resolves.toBeUndefined();
    expect(await getAllRecents()).toEqual([]);
    await expect(recordView('topic-a')).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);

    indexedDB.open = originalOpen;
    warnSpy.mockRestore();
  });
});
