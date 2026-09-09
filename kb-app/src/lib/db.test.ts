import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import {
  __resetDbForTests,
  exportAllData,
  getAllFavorites,
  getAllNotes,
  getAllProgress,
  getAllRecents,
  getAllSrsCards,
  importAllData,
  recordView,
  setFavorite,
  setNote,
  setProgress,
  setSrsCard,
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

  it('setFavorite(true) adds a favorite, then setFavorite(false) removes it', async () => {
    await setFavorite('topic-a', true);
    expect(await getAllFavorites()).toHaveLength(1);
    await setFavorite('topic-a', false);
    expect(await getAllFavorites()).toEqual([]);
  });

  it('setFavorite is idempotent — repeat calls with the same value do not toggle', async () => {
    await setFavorite('topic-a', true);
    await setFavorite('topic-a', true);
    expect(await getAllFavorites()).toHaveLength(1);
    await setFavorite('topic-a', false);
    await setFavorite('topic-a', false);
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

describe('db — notes', () => {
  it('returns an empty array when no notes exist', async () => {
    expect(await getAllNotes()).toEqual([]);
  });

  it('setNote writes a record retrievable via getAllNotes', async () => {
    await setNote('topic-a', 'my note text');
    const all = await getAllNotes();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ topicId: 'topic-a', text: 'my note text' });
    expect(all[0].updatedAt).toEqual(expect.any(Number));
  });

  it('setNote overwrites the existing record for the same topic', async () => {
    await setNote('topic-a', 'first');
    await setNote('topic-a', 'second');
    const all = await getAllNotes();
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe('second');
  });

  it('setNote deletes the record when text is empty or whitespace-only', async () => {
    await setNote('topic-a', 'something');
    expect(await getAllNotes()).toHaveLength(1);
    await setNote('topic-a', '   ');
    expect(await getAllNotes()).toEqual([]);
  });
});

describe('db — srsCards', () => {
  it('returns an empty array when nothing is stored', async () => {
    expect(await getAllSrsCards()).toEqual([]);
  });

  it('setSrsCard writes a record retrievable via getAllSrsCards', async () => {
    const card = { topicId: 'topic-a', ease: 2.5, intervalDays: 1, dueAt: 1000, reps: 1, lapses: 0, updatedAt: 1000 };
    await setSrsCard(card);
    expect(await getAllSrsCards()).toEqual([card]);
  });

  it('setSrsCard overwrites the existing record for the same topic', async () => {
    await setSrsCard({ topicId: 'topic-a', ease: 2.5, intervalDays: 1, dueAt: 1000, reps: 1, lapses: 0, updatedAt: 1000 });
    await setSrsCard({ topicId: 'topic-a', ease: 2.3, intervalDays: 2, dueAt: 2000, reps: 2, lapses: 1, updatedAt: 2000 });
    const all = await getAllSrsCards();
    expect(all).toHaveLength(1);
    expect(all[0].intervalDays).toBe(2);
  });
});

describe('db — v2 to v3 migration', () => {
  it('preserves an existing v2 store and adds srsCards when upgraded to v3', async () => {
    const v2db = await openDB('kb-user-data', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'topicId' });
        if (!db.objectStoreNames.contains('favorites')) db.createObjectStore('favorites', { keyPath: 'topicId' });
        if (!db.objectStoreNames.contains('recents')) db.createObjectStore('recents', { keyPath: 'topicId' });
        if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'topicId' });
      },
    });
    await v2db.put('progress', { topicId: 'topic-a', status: 'learning', updatedAt: 1 });
    v2db.close();

    expect(await getAllProgress()).toEqual([{ topicId: 'topic-a', status: 'learning', updatedAt: 1 }]);
    expect(await getAllSrsCards()).toEqual([]);
  });
});

describe('db — export/import', () => {
  it('exportAllData returns version 1, an ISO timestamp, and all five tables', async () => {
    await setProgress('topic-a', 'learning');
    await setFavorite('topic-b', true);
    await recordView('topic-c');
    await setNote('topic-d', 'a note');
    await setSrsCard({ topicId: 'topic-e', ease: 2.5, intervalDays: 1, dueAt: 1000, reps: 1, lapses: 0, updatedAt: 1000 });

    const payload = await exportAllData();

    expect(payload.version).toBe(1);
    expect(new Date(payload.exportedAt).toString()).not.toBe('Invalid Date');
    expect(payload.data.progress).toHaveLength(1);
    expect(payload.data.favorites).toHaveLength(1);
    expect(payload.data.recents).toHaveLength(1);
    expect(payload.data.notes).toHaveLength(1);
    expect(payload.data.srsCards).toHaveLength(1);
  });

  it('exportAllData returns empty arrays when nothing is stored', async () => {
    const payload = await exportAllData();
    expect(payload.data).toEqual({ progress: [], favorites: [], recents: [], notes: [], srsCards: [] });
  });

  it('importAllData round-trips an exported payload unchanged', async () => {
    await setProgress('topic-a', 'mastered');
    await setNote('topic-a', 'hello');
    const exported = await exportAllData();

    await importAllData(exported.data);

    const reimported = await exportAllData();
    expect(reimported.data).toEqual(exported.data);
  });

  it('importAllData fully replaces existing rows rather than merging', async () => {
    await setProgress('old-topic', 'mastered');
    await setNote('old-topic', 'old note');

    await importAllData({
      progress: [{ topicId: 'new-topic', status: 'new', updatedAt: 1 }],
      favorites: [],
      recents: [],
      notes: [],
      srsCards: [],
    });

    expect(await getAllProgress()).toEqual([{ topicId: 'new-topic', status: 'new', updatedAt: 1 }]);
    expect(await getAllNotes()).toEqual([]);
  });

  it('importAllData resolves without throwing when IndexedDB is unavailable', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const originalOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = () => {
      throw new Error('boom');
    };

    await expect(
      importAllData({ progress: [], favorites: [], recents: [], notes: [], srsCards: [] }),
    ).resolves.toBe(false);

    indexedDB.open = originalOpen;
    warnSpy.mockRestore();
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
    await expect(setFavorite('topic-a', true)).resolves.toBeUndefined();
    expect(await getAllRecents()).toEqual([]);
    await expect(recordView('topic-a')).resolves.toBeUndefined();
    expect(await getAllNotes()).toEqual([]);
    await expect(setNote('topic-a', 'text')).resolves.toBeUndefined();
    expect(await getAllSrsCards()).toEqual([]);
    await expect(
      setSrsCard({ topicId: 'topic-a', ease: 2.5, intervalDays: 1, dueAt: 1000, reps: 1, lapses: 0, updatedAt: 1000 }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);

    indexedDB.open = originalOpen;
    warnSpy.mockRestore();
  });
});
