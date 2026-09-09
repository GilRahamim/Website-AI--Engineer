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

type SelectResult = { data: Record<string, unknown>[] | null; error?: unknown };

/** Builds a chainable fake query builder for one table. `selectResult` is
 *  what `.select('*')` (optionally followed by `.gt(...)`) resolves to —
 *  including a Supabase-style `{ data: null, error }` failure, which
 *  resolves rather than rejects, exactly as supabase-js does. `upsert` and
 *  `in` (the tail of the `.delete().eq(...).in(...)` chain) are spies the
 *  test can assert against. */
function makeTableMock(selectResult: SelectResult = { data: [] }) {
  const gt = vi.fn(() => Promise.resolve(selectResult));
  const select = vi.fn(() => ({ gt, then: (resolve: (v: SelectResult) => void) => resolve(selectResult) }));
  const upsert = vi.fn<(rows: Record<string, unknown>[]) => Promise<{ error: unknown }>>(() =>
    Promise.resolve({ error: null }),
  );
  const inFn = vi.fn<(column: string, ids: string[]) => Promise<{ error: unknown }>>(() =>
    Promise.resolve({ error: null }),
  );
  const eq = vi.fn<(column: string, value: string) => { in: typeof inFn }>(() => ({ in: inFn }));
  const del = vi.fn(() => ({ eq }));
  return { select, gt, upsert, delete: del, eq, in: inFn };
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

const { fullSync, pullSince, pushDirty } = await import('./sync');

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

  it('exact timestamp tie is a no-op — neither side is written', async () => {
    await setProgress('topic-p', 'learning');
    const localRows = await getAllProgress();
    const remoteRow = { topic_id: 'topic-p', status: 'learning', updated_at: new Date(localRows[0].updatedAt).toISOString() };
    const progressMock = makeTableMock({ data: [remoteRow] });
    mockTables({ progress: progressMock, notes: makeTableMock(), favorites: makeTableMock(), srs_cards: makeTableMock() });

    await fullSync();

    expect(progressMock.upsert).not.toHaveBeenCalled();
  });

  it('two consecutive fullSync calls with no changes only reconcile once', async () => {
    await setProgress('topic-q', 'new');
    const progressMock = makeTableMock({ data: [] });
    mockTables({ progress: progressMock, notes: makeTableMock(), favorites: makeTableMock(), srs_cards: makeTableMock() });

    await fullSync();
    expect(progressMock.upsert).toHaveBeenCalledTimes(1);

    // Second call: remote now has the pushed row, matching what was just pushed.
    const pushedRow = progressMock.upsert.mock.calls[0][0][0];
    progressMock.select.mockReturnValue({
      gt: progressMock.gt,
      then: (resolve: (v: SelectResult) => void) => resolve({ data: [pushedRow] }),
    });

    await fullSync();
    expect(progressMock.upsert).toHaveBeenCalledTimes(1); // still 1 — not called again
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
    progressMock.upsert.mockResolvedValue({ error: new Error('network error') });
    const favoritesMock = makeTableMock({ data: [] });
    mockTables({ progress: progressMock, notes: makeTableMock(), favorites: favoritesMock, srs_cards: makeTableMock() });

    await expect(fullSync()).resolves.toBeUndefined();
    expect(favoritesMock.upsert).toHaveBeenCalledTimes(1);
  });

  it("a select resolving with an error leaves that table's local data untouched", async () => {
    await setProgress('topic-s', 'new');
    await setSyncManifest({
      id: 'manifest',
      tables: { progress: ['topic-s'], notes: [], favorites: [], srsCards: [] },
      syncedAt: NOW,
    });
    mockTables({
      progress: makeTableMock({ data: null, error: new Error('select failed') }),
      notes: makeTableMock(),
      favorites: makeTableMock(),
      srs_cards: makeTableMock(),
    });

    await fullSync();

    expect(await getAllProgress()).toHaveLength(1);
  });

  it('an upsert resolving with an error does not advance that row into the manifest', async () => {
    await setProgress('topic-t', 'new');
    const progressMock = makeTableMock({ data: [] });
    progressMock.upsert.mockResolvedValue({ error: new Error('upsert failed') });
    mockTables({ progress: progressMock, notes: makeTableMock(), favorites: makeTableMock(), srs_cards: makeTableMock() });

    await fullSync();

    const manifest = await getSyncManifest();
    expect(manifest?.tables.progress ?? []).not.toContain('topic-t');
  });

  it('one table resolving an error (not rejecting) does not stop the others', async () => {
    await setProgress('topic-u', 'new');
    await setFavorite('topic-v', true);
    mockTables({
      progress: makeTableMock({ data: null, error: new Error('down') }),
      notes: makeTableMock(),
      favorites: makeTableMock({ data: [] }),
      srs_cards: makeTableMock(),
    });

    await expect(fullSync()).resolves.toBeUndefined();
    const manifest = await getSyncManifest();
    expect(manifest?.tables.favorites).toContain('topic-v');
  });

  it('all four tables failing leaves the stored manifest completely unchanged', async () => {
    await setSyncManifest({
      id: 'manifest',
      tables: { progress: ['a'], notes: [], favorites: [], srsCards: [] },
      syncedAt: 1000,
    });
    const failing = () => makeTableMock({ data: null, error: new Error('down') });
    mockTables({ progress: failing(), notes: failing(), favorites: failing(), srs_cards: failing() });

    await fullSync();

    const manifest = await getSyncManifest();
    expect(manifest?.syncedAt).toBe(1000);
    expect(manifest?.tables.progress).toEqual(['a']);
  });
});

describe('pushDirty', () => {
  it('pushes a new local row and never writes to local IndexedDB or the manifest', async () => {
    await setProgress('topic-k', 'learning');
    const progressMock = makeTableMock({ data: [] });
    mockTables({ progress: progressMock, notes: makeTableMock(), favorites: makeTableMock(), srs_cards: makeTableMock() });

    await pushDirty();

    expect(progressMock.upsert).toHaveBeenCalledTimes(1);
    expect(await getSyncManifest()).toBeNull();
  });

  it('detects and pushes a local deletion using the stored manifest, without pulling', async () => {
    await setSyncManifest({
      id: 'manifest',
      tables: { progress: [], notes: [], favorites: ['topic-l'], srsCards: [] },
      syncedAt: NOW,
    });
    const remoteRow = { topic_id: 'topic-l', created_at: new Date(NOW).toISOString() };
    const favoritesMock = makeTableMock({ data: [remoteRow] });
    mockTables({ progress: makeTableMock(), notes: makeTableMock(), favorites: favoritesMock, srs_cards: makeTableMock() });

    await pushDirty();

    expect(favoritesMock.in).toHaveBeenCalledWith('topic_id', ['topic-l']);
  });

  it('does not write to local IndexedDB even when a remote-only new row exists', async () => {
    const remoteRow = { topic_id: 'topic-m', status: 'new', updated_at: new Date(NOW).toISOString() };
    mockTables({
      progress: makeTableMock({ data: [remoteRow] }),
      notes: makeTableMock(),
      favorites: makeTableMock(),
      srs_cards: makeTableMock(),
    });

    await pushDirty();

    expect(await getAllProgress()).toEqual([]);
  });

  it('no-ops when getSupabase() returns null', async () => {
    mockGetSupabase.mockReturnValue(null);
    await expect(pushDirty()).resolves.toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('pullSince', () => {
  it('filters the remote query by the given timestamp', async () => {
    const progressMock = makeTableMock({ data: [] });
    mockTables({ progress: progressMock, notes: makeTableMock(), favorites: makeTableMock(), srs_cards: makeTableMock() });

    await pullSince(NOW);

    expect(progressMock.gt).toHaveBeenCalledWith('updated_at', new Date(NOW).toISOString());
  });

  it('pulls a new remote row into local IndexedDB and never writes to the manifest', async () => {
    const remoteRow = { topic_id: 'topic-n', status: 'mastered', updated_at: new Date(NOW).toISOString() };
    mockTables({
      progress: makeTableMock({ data: [remoteRow] }),
      notes: makeTableMock(),
      favorites: makeTableMock(),
      srs_cards: makeTableMock(),
    });

    await pullSince(NOW - 1000);

    const all = await getAllProgress();
    expect(all).toEqual([{ topicId: 'topic-n', status: 'mastered', updatedAt: NOW }]);
    expect(await getSyncManifest()).toBeNull();
  });

  it('never calls upsert or delete against the remote', async () => {
    await setProgress('topic-o', 'new'); // present only locally
    const progressMock = makeTableMock({ data: [] });
    mockTables({ progress: progressMock, notes: makeTableMock(), favorites: makeTableMock(), srs_cards: makeTableMock() });

    await pullSince(0);

    expect(progressMock.upsert).not.toHaveBeenCalled();
    expect(progressMock.in).not.toHaveBeenCalled();
  });

  it('does not delete a local row that is simply unchanged (present locally, in manifest, absent from the filtered remote result)', async () => {
    await setFavorite('topic-r', true);
    const localRows = await getAllFavorites();
    await setSyncManifest({
      id: 'manifest',
      tables: { progress: [], notes: [], favorites: ['topic-r'], srsCards: [] },
      syncedAt: localRows[0].createdAt,
    });
    // Filtered query legitimately returns nothing — topic-r hasn't changed since ts.
    mockTables({ progress: makeTableMock(), notes: makeTableMock(), favorites: makeTableMock({ data: [] }), srs_cards: makeTableMock() });

    await pullSince(localRows[0].createdAt + 1);

    expect(await getAllFavorites()).toHaveLength(1);
  });

  it('no-ops when there is no active session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(pullSince(0)).resolves.toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
