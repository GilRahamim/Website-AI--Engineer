import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  __resetDbForTests,
  getAllFavorites,
  getAllNotes,
  getAllProgress,
  getSyncManifest,
  setFavorite,
  setNote,
  setProgress,
  setSrsCard,
  setSyncManifest,
} from './db';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

const mockClient = {
  auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  from: (...args: unknown[]) => mockFrom(...args),
};

const mockGetSupabase = vi.fn<() => typeof mockClient | null>(() => mockClient);

vi.mock('./supabase', () => ({
  getSupabase: () => mockGetSupabase(),
}));

/** Builds a chainable fake query builder for one table. `selectResult` is
 *  what `.select('*')` (optionally followed by `.gt(...)`) resolves to;
 *  `upsert`/`deleteIn` are spies the test can assert against. */
function makeTableMock(selectResult: { data: Record<string, unknown>[] } = { data: [] }) {
  const gt = vi.fn(() => Promise.resolve(selectResult));
  const select = vi.fn(() => ({ gt, then: (resolve: (v: typeof selectResult) => void) => resolve(selectResult) }));
  const upsert = vi.fn<(rows: Record<string, unknown>[]) => Promise<{ error: null }>>(() =>
    Promise.resolve({ error: null }),
  );
  const inFn = vi.fn<(column: string, ids: string[]) => Promise<{ error: null }>>(() =>
    Promise.resolve({ error: null }),
  );
  const del = vi.fn(() => ({ in: inFn }));
  return { select, gt, upsert, delete: del, in: inFn };
}

function mockTables(byTable: Record<string, ReturnType<typeof makeTableMock>>) {
  mockFrom.mockImplementation((table: string) => byTable[table] ?? makeTableMock());
}

const NOW = 1_700_000_000_000;

beforeEach(() => {
  // eslint-disable-next-line no-global-assign
  indexedDB = new IDBFactory();
  __resetDbForTests();
  mockGetSupabase.mockReset().mockReturnValue(mockClient);
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } } });
  mockFrom.mockReset();
  mockTables({});
});

const { fullSync } = await import('./sync');

describe('fullSync — no-op cases', () => {
  it('does nothing when getSupabase() returns null', async () => {
    mockGetSupabase.mockReturnValue(null);
    await fullSync();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does nothing when there is no active session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await fullSync();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('fullSync — push', () => {
  it('pushes a brand-new local row with no manifest entry', async () => {
    await setProgress('topic-a', 'mastered');
    const progressMock = makeTableMock({ data: [] });
    mockTables({ progress: progressMock, notes: makeTableMock(), favorites: makeTableMock(), srs_cards: makeTableMock() });

    await fullSync();

    expect(progressMock.upsert).toHaveBeenCalledTimes(1);
    const pushed = progressMock.upsert.mock.calls[0][0];
    expect(pushed).toEqual([
      expect.objectContaining({ user_id: 'user-1', topic_id: 'topic-a', status: 'mastered' }),
    ]);
    expect(typeof pushed[0].updated_at).toBe('string'); // ISO string, not epoch ms
  });

  it('pushes an srsCard with correctly renamed/converted fields', async () => {
    await setSrsCard({ topicId: 'topic-j', ease: 2.3, intervalDays: 4, dueAt: NOW, reps: 2, lapses: 0, updatedAt: NOW });
    const srsMock = makeTableMock({ data: [] });
    mockTables({ progress: makeTableMock(), notes: makeTableMock(), favorites: makeTableMock(), srs_cards: srsMock });

    await fullSync();

    expect(srsMock.upsert.mock.calls[0][0][0]).toEqual(
      expect.objectContaining({
        topic_id: 'topic-j',
        ease: 2.3,
        interval_days: 4,
        reps: 2,
        lapses: 0,
        due_at: new Date(NOW).toISOString(),
        updated_at: new Date(NOW).toISOString(),
      }),
    );
  });
});

describe('fullSync — pull', () => {
  it('pulls a brand-new remote row with no manifest entry, preserving its timestamp', async () => {
    const remoteRow = { topic_id: 'topic-b', status: 'learning', updated_at: new Date(NOW).toISOString() };
    mockTables({
      progress: makeTableMock({ data: [remoteRow] }),
      notes: makeTableMock(),
      favorites: makeTableMock(),
      srs_cards: makeTableMock(),
    });

    await fullSync();

    const all = await getAllProgress();
    expect(all).toEqual([{ topicId: 'topic-b', status: 'learning', updatedAt: NOW }]);
  });
});

describe('fullSync — conflict resolution', () => {
  it('local wins when its timestamp is newer (pushes, overwriting remote)', async () => {
    await setNote('topic-c', 'local newer text');
    const localRows = await getAllNotes();
    const remoteRow = {
      topic_id: 'topic-c',
      text: 'remote older text',
      updated_at: new Date(localRows[0].updatedAt - 10_000).toISOString(),
    };
    const notesMock = makeTableMock({ data: [remoteRow] });
    mockTables({ progress: makeTableMock(), notes: notesMock, favorites: makeTableMock(), srs_cards: makeTableMock() });

    await fullSync();

    expect(notesMock.upsert).toHaveBeenCalledTimes(1);
    expect(notesMock.upsert.mock.calls[0][0][0]).toEqual(
      expect.objectContaining({ topic_id: 'topic-c', text: 'local newer text' }),
    );
  });

  it('remote wins when its timestamp is newer (pulls, overwriting local)', async () => {
    await setNote('topic-d', 'local older text');
    const localRows = await getAllNotes();
    const remoteRow = {
      topic_id: 'topic-d',
      text: 'remote newer text',
      updated_at: new Date(localRows[0].updatedAt + 10_000).toISOString(),
    };
    mockTables({
      progress: makeTableMock(),
      notes: makeTableMock({ data: [remoteRow] }),
      favorites: makeTableMock(),
      srs_cards: makeTableMock(),
    });

    await fullSync();

    const all = await getAllNotes();
    expect(all[0].text).toBe('remote newer text');
  });
});

describe('fullSync — deletions', () => {
  it('a row missing remotely but present in the manifest is deleted locally', async () => {
    await setFavorite('topic-e', true);
    await setSyncManifest({
      id: 'manifest',
      tables: { progress: [], notes: [], favorites: ['topic-e'], srsCards: [] },
      syncedAt: NOW,
    });
    mockTables({ progress: makeTableMock(), notes: makeTableMock(), favorites: makeTableMock({ data: [] }), srs_cards: makeTableMock() });

    await fullSync();

    expect(await getAllFavorites()).toEqual([]);
    const manifest = await getSyncManifest();
    expect(manifest?.tables.favorites).not.toContain('topic-e');
  });

  it('a row missing locally but present in the manifest is deleted remotely', async () => {
    await setSyncManifest({
      id: 'manifest',
      tables: { progress: [], notes: [], favorites: ['topic-f'], srsCards: [] },
      syncedAt: NOW,
    });
    const remoteRow = { topic_id: 'topic-f', created_at: new Date(NOW).toISOString() };
    const favoritesMock = makeTableMock({ data: [remoteRow] });
    mockTables({ progress: makeTableMock(), notes: makeTableMock(), favorites: favoritesMock, srs_cards: makeTableMock() });

    await fullSync();

    expect(favoritesMock.in).toHaveBeenCalledWith('topic_id', ['topic-f']);
    const manifest = await getSyncManifest();
    expect(manifest?.tables.favorites).not.toContain('topic-f');
  });
});

describe('fullSync — manifest and resilience', () => {
  it('writes a fresh manifest reflecting the post-sync state', async () => {
    await setProgress('topic-g', 'new');
    mockTables({ progress: makeTableMock({ data: [] }), notes: makeTableMock(), favorites: makeTableMock(), srs_cards: makeTableMock() });

    await fullSync();

    const manifest = await getSyncManifest();
    expect(manifest?.tables.progress).toContain('topic-g');
    expect(manifest?.syncedAt).toEqual(expect.any(Number));
  });

  it('one table failing does not stop the others or make fullSync reject', async () => {
    await setProgress('topic-h', 'new');
    await setFavorite('topic-i', true);
    const progressMock = makeTableMock({ data: [] });
    progressMock.upsert.mockRejectedValue(new Error('network error'));
    const favoritesMock = makeTableMock({ data: [] });
    mockTables({ progress: progressMock, notes: makeTableMock(), favorites: favoritesMock, srs_cards: makeTableMock() });

    await expect(fullSync()).resolves.toBeUndefined();
    expect(favoritesMock.upsert).toHaveBeenCalledTimes(1);
  });
});
