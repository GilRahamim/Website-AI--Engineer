# Phase 5, Sub-project #3b — Sync Engine Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `kb-app/src/lib/sync.ts` (`pushDirty()`, `pullSince(ts)`, `fullSync()`) plus the low-level `db.ts` support they need, so the four synced IndexedDB stores can be reconciled against Supabase in both directions — including correctly propagating deletions — with no UI or auto-trigger wiring.

**Architecture:** One shared internal `reconcileTable()` helper does per-table 3-way-merge classification (local rows vs. remote rows vs. a stored manifest of "ids as of last successful sync"), and the three exported functions call it with different direction flags. `db.ts` gains a new `syncMeta` IndexedDB store plus generic `putRows`/`deleteRows` helpers that write pulled rows with their true remote timestamps (the existing UI-facing setters always stamp `Date.now()`, which would be wrong for a pull).

**Tech Stack:** `idb` (already a dependency), `@supabase/supabase-js` (already a dependency), Vitest + `fake-indexeddb` for tests.

**Spec:** `docs/superpowers/specs/2026-09-09-phase5-sync-engine-core-design.md`

## Global Constraints

- New file: `kb-app/src/lib/sync.ts`, exporting exactly `pushDirty(): Promise<void>`, `pullSince(ts: number): Promise<void>`, `fullSync(): Promise<void>`. No other exports from this file are part of its public surface (helper functions stay unexported).
- Only four tables sync: `progress`, `notes`, `favorites`, `srsCards` (remote names: `progress`, `notes`, `favorites`, `srs_cards`). `recents` is never touched by this file.
- Deletion classification (corrected in the spec — read carefully, the reasoning is easy to get backwards): a row present **locally but absent remotely**, whose id **is** in the last-sync manifest, means remote lost it since — delete it **locally** to match. A row present **remotely but absent locally**, whose id **is** in the manifest, means this device deleted it since — delete it **remotely**. An id absent from the manifest on either side (present-only, never previously synced) is a brand-new row — push or pull it, never delete.
- Conflict resolution (both sides have the row): the row with the newer timestamp wins and overwrites the other side. Exact tie → remote wins (deterministic, avoids a coin flip). Applies uniformly, including `notes.text` — no special merge logic for v1.
- Timestamp conversion: local epoch-ms → `new Date(ms).toISOString()` when pushing; remote `timestamptz` ISO string → `new Date(iso).getTime()` when pulling.
- Every exported function: `getSupabase()` returning `null`, or no active session (`supabase.auth.getUser()` resolves with no user), is a **no-op** — resolves immediately, never throws. One table's remote call rejecting must not prevent the other three tables from reconciling, and must not make the exported function reject.
- `pushDirty()` and `pullSince()` read the stored manifest (for delete detection) but never write it. Only `fullSync()` writes a new manifest, after all four tables reconcile.
- No changes to `kb-app/src/store/userDataStore.ts`, anything under `kb-app/src/pages/` or `kb-app/src/components/`, or `kb-app/src/App.tsx` — this plan is `lib/`-only.
- After every task: `npm run typecheck && npm run lint && npm run test && npm run build` (from `kb-app/`) must be green.

---

### Task 1: `db.ts` — sync storage primitives

**Files:**
- Modify: `kb-app/src/lib/db.ts`
- Test: `kb-app/src/lib/db.test.ts`

**Interfaces:**
- Consumes: nothing new (uses the existing `getDb()`/`warnOnce()` internals already in the file).
- Produces (for Task 2/3 to consume):
  ```ts
  export type SyncTableName = 'progress' | 'notes' | 'favorites' | 'srsCards';

  export interface SyncManifest {
    id: 'manifest';
    tables: Record<SyncTableName, string[]>;
    syncedAt: number;
  }

  export async function putRows(
    table: SyncTableName,
    rows: (Progress | Note | Favorite | SrsCard)[],
  ): Promise<void>;

  export async function deleteRows(table: SyncTableName, topicIds: string[]): Promise<void>;
  export async function getSyncManifest(): Promise<SyncManifest | null>;
  export async function setSyncManifest(manifest: SyncManifest): Promise<void>;
  ```

- [ ] **Step 1: Write the failing tests**

Add to `kb-app/src/lib/db.test.ts` (extend the existing `import` list at the top of the file with `deleteRows, getSyncManifest, putRows, setSyncManifest` alongside the current imports), and add this new `describe` block:

```ts
describe('db — sync primitives', () => {
  it('putRows writes rows with their own timestamps (not Date.now())', async () => {
    await putRows('progress', [{ topicId: 'topic-a', status: 'mastered', updatedAt: 12345 }]);
    const all = await getAllProgress();
    expect(all).toEqual([{ topicId: 'topic-a', status: 'mastered', updatedAt: 12345 }]);
  });

  it('putRows overwrites an existing row with the same topicId', async () => {
    await setProgress('topic-a', 'new');
    await putRows('progress', [{ topicId: 'topic-a', status: 'mastered', updatedAt: 999 }]);
    const all = await getAllProgress();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual({ topicId: 'topic-a', status: 'mastered', updatedAt: 999 });
  });

  it('deleteRows removes only the given topicIds', async () => {
    await setFavorite('topic-a', true);
    await setFavorite('topic-b', true);
    await deleteRows('favorites', ['topic-a']);
    const all = await getAllFavorites();
    expect(all.map((r) => r.topicId)).toEqual(['topic-b']);
  });

  it('deleteRows on a non-existent id is a no-op, not an error', async () => {
    await expect(deleteRows('notes', ['does-not-exist'])).resolves.toBeUndefined();
  });

  it('getSyncManifest returns null when none has been stored', async () => {
    expect(await getSyncManifest()).toBeNull();
  });

  it('setSyncManifest then getSyncManifest round-trips', async () => {
    const manifest = {
      id: 'manifest' as const,
      tables: { progress: ['a'], notes: [], favorites: ['b', 'c'], srsCards: [] },
      syncedAt: 1700000000000,
    };
    await setSyncManifest(manifest);
    expect(await getSyncManifest()).toEqual(manifest);
  });

  it('setSyncManifest overwrites a previously stored manifest', async () => {
    await setSyncManifest({ id: 'manifest', tables: { progress: [], notes: [], favorites: [], srsCards: [] }, syncedAt: 1 });
    await setSyncManifest({ id: 'manifest', tables: { progress: ['x'], notes: [], favorites: [], srsCards: [] }, syncedAt: 2 });
    const manifest = await getSyncManifest();
    expect(manifest?.tables.progress).toEqual(['x']);
    expect(manifest?.syncedAt).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- db.test.ts` (from `kb-app/`)
Expected: FAIL — `putRows`, `deleteRows`, `getSyncManifest`, `setSyncManifest` are not exported from `./db` yet (import error / undefined).

- [ ] **Step 3: Implement**

In `kb-app/src/lib/db.ts`:

1. Add `SyncTableName` and `SyncManifest` to the top-level exports (near the top, after the existing `ExportPayload` interface):

```ts
export type SyncTableName = 'progress' | 'notes' | 'favorites' | 'srsCards';

export interface SyncManifest {
  id: 'manifest';
  tables: Record<SyncTableName, string[]>;
  syncedAt: number;
}
```

2. Add `syncMeta` to the `KbUserDataSchema` interface:

```ts
interface KbUserDataSchema extends DBSchema {
  progress: { key: string; value: Progress };
  favorites: { key: string; value: Favorite };
  recents: { key: string; value: Recent };
  notes: { key: string; value: Note };
  srsCards: { key: string; value: SrsCard };
  syncMeta: { key: string; value: SyncManifest };
}
```

3. Bump `DB_VERSION` from `3` to `4`, and add the new store to the `upgrade()` callback (after the existing `srsCards` branch):

```ts
if (!db.objectStoreNames.contains('syncMeta')) {
  db.createObjectStore('syncMeta', { keyPath: 'id' });
}
```

4. Add the four new functions at the end of the file, immediately before `__resetDbForTests`:

```ts
/** Writes rows exactly as given — including their own `updatedAt`/`createdAt`
 *  timestamps — unlike the UI-facing setters (setProgress, setFavorite, etc.)
 *  which always stamp `Date.now()`. Used only by the sync engine when
 *  applying a pulled remote row, which must keep its true remote timestamp
 *  so future last-write-wins comparisons stay correct. */
export async function putRows(
  table: SyncTableName,
  rows: (Progress | Note | Favorite | SrsCard)[],
): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(table, 'readwrite');
    await Promise.all([...rows.map((row) => tx.objectStore(table).put(row as never)), tx.done]);
  } catch (error) {
    warnOnce(`putRows:${table}`, error);
  }
}

/** Used only by the sync engine to apply a remote deletion locally. */
export async function deleteRows(table: SyncTableName, topicIds: string[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(table, 'readwrite');
    await Promise.all([...topicIds.map((id) => tx.objectStore(table).delete(id)), tx.done]);
  } catch (error) {
    warnOnce(`deleteRows:${table}`, error);
  }
}

export async function getSyncManifest(): Promise<SyncManifest | null> {
  try {
    const db = await getDb();
    const record = await db.get('syncMeta', 'manifest');
    return record ?? null;
  } catch (error) {
    warnOnce('getSyncManifest', error);
    return null;
  }
}

export async function setSyncManifest(manifest: SyncManifest): Promise<void> {
  try {
    const db = await getDb();
    await db.put('syncMeta', manifest);
  } catch (error) {
    warnOnce('setSyncManifest', error);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- db.test.ts` (from `kb-app/`)
Expected: PASS, including every pre-existing test in the file (the `DB_VERSION` bump must not break anything already there — `fake-indexeddb` rebuilds from scratch per test via the file's existing `beforeEach`, so this should be automatic, but confirm no failures).

- [ ] **Step 5: Full pipeline check and commit**

Run: `npm run typecheck && npm run lint && npm run test && npm run build` (from `kb-app/`)
Expected: all green.

```bash
git add kb-app/src/lib/db.ts kb-app/src/lib/db.test.ts
git commit -m "feat: add sync storage primitives to db.ts (putRows, deleteRows, sync manifest)"
```

---

### Task 2: `sync.ts` — reconciliation core + `fullSync()`

**Files:**
- Create: `kb-app/src/lib/sync.ts`
- Test: `kb-app/src/lib/sync.test.ts`

**Interfaces:**
- Consumes: `SyncTableName`, `SyncManifest`, `putRows`, `deleteRows`, `getSyncManifest`, `setSyncManifest` from `./db` (Task 1); `getAllProgress`, `getAllNotes`, `getAllFavorites`, `getAllSrsCards` from `./db` (pre-existing); `getSupabase` from `./supabase` (pre-existing); `Progress`, `Note`, `Favorite`, `SrsCard` from `../types` (pre-existing).
- Produces: `export async function fullSync(): Promise<void>` (the only export this task adds — `pushDirty`/`pullSince` are Task 3). The unexported `reconcileTable` helper this task builds is what Task 3 will also call.

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/lib/sync.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  __resetDbForTests,
  getAllFavorites,
  getAllNotes,
  getAllProgress,
  getAllSrsCards,
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
  const upsert = vi.fn(() => Promise.resolve({ error: null }));
  const inFn = vi.fn(() => Promise.resolve({ error: null }));
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
```

Also add `srs_cards`/`intervalDays` coverage via one more test in the same `describe('fullSync — push')` block:

```ts
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
```

(Add the `setSrsCard` import to the test file's import list above alongside the others.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- sync.test.ts` (from `kb-app/`)
Expected: FAIL — `./sync` does not exist yet.

- [ ] **Step 3: Implement `kb-app/src/lib/sync.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import {
  deleteRows,
  getAllFavorites,
  getAllNotes,
  getAllProgress,
  getAllSrsCards,
  getSyncManifest,
  putRows,
  setSyncManifest,
  type SyncManifest,
  type SyncTableName,
} from './db';
import type { Favorite, Note, Progress, SrsCard } from '../types';

type LocalRow = Progress | Note | Favorite | SrsCard;
type RemoteRow = Record<string, unknown>;
type Direction = 'push' | 'pull' | 'full';

const TABLES: SyncTableName[] = ['progress', 'notes', 'favorites', 'srsCards'];

const REMOTE_TABLE: Record<SyncTableName, string> = {
  progress: 'progress',
  notes: 'notes',
  favorites: 'favorites',
  srsCards: 'srs_cards',
};

// Timestamp column used both for LWW conflict comparison and pullSince's
// server-side filter. `favorites` has no updated_at locally or remotely
// (matching kb-app/supabase/schema.sql) — created_at stands in for it.
const TIMESTAMP_COLUMN: Record<SyncTableName, string> = {
  progress: 'updated_at',
  notes: 'updated_at',
  favorites: 'created_at',
  srsCards: 'updated_at',
};

function localTimestamp(table: SyncTableName, row: LocalRow): number {
  return table === 'favorites' ? (row as Favorite).createdAt : (row as Progress | Note | SrsCard).updatedAt;
}

function remoteTimestamp(table: SyncTableName, row: RemoteRow): number {
  return new Date(row[TIMESTAMP_COLUMN[table]] as string).getTime();
}

function toRemoteRow(table: SyncTableName, row: LocalRow, userId: string): RemoteRow {
  const base = { user_id: userId, topic_id: row.topicId };
  switch (table) {
    case 'progress': {
      const r = row as Progress;
      return { ...base, status: r.status, updated_at: new Date(r.updatedAt).toISOString() };
    }
    case 'notes': {
      const r = row as Note;
      return { ...base, text: r.text, updated_at: new Date(r.updatedAt).toISOString() };
    }
    case 'favorites': {
      const r = row as Favorite;
      return { ...base, created_at: new Date(r.createdAt).toISOString() };
    }
    case 'srsCards': {
      const r = row as SrsCard;
      return {
        ...base,
        ease: r.ease,
        interval_days: r.intervalDays,
        due_at: new Date(r.dueAt).toISOString(),
        reps: r.reps,
        lapses: r.lapses,
        updated_at: new Date(r.updatedAt).toISOString(),
      };
    }
  }
}

function fromRemoteRow(table: SyncTableName, row: RemoteRow): LocalRow {
  const topicId = row.topic_id as string;
  switch (table) {
    case 'progress':
      return { topicId, status: row.status as Progress['status'], updatedAt: new Date(row.updated_at as string).getTime() };
    case 'notes':
      return { topicId, text: row.text as string, updatedAt: new Date(row.updated_at as string).getTime() };
    case 'favorites':
      return { topicId, createdAt: new Date(row.created_at as string).getTime() };
    case 'srsCards':
      return {
        topicId,
        ease: row.ease as number,
        intervalDays: row.interval_days as number,
        dueAt: new Date(row.due_at as string).getTime(),
        reps: row.reps as number,
        lapses: row.lapses as number,
        updatedAt: new Date(row.updated_at as string).getTime(),
      };
  }
}

async function getLocalRows(table: SyncTableName): Promise<LocalRow[]> {
  switch (table) {
    case 'progress':
      return getAllProgress();
    case 'notes':
      return getAllNotes();
    case 'favorites':
      return getAllFavorites();
    case 'srsCards':
      return getAllSrsCards();
  }
}

/** Reconciles one table in one direction, using `manifestIds` (the ids known
 *  to exist on both sides as of the last successful fullSync) to tell a
 *  brand-new row apart from a deletion. Returns the resulting set of ids
 *  this table should hold on BOTH sides once `direction === 'full'` has
 *  applied every branch — callers reconciling only one direction (push or
 *  pull) may ignore the return value, since it isn't a complete picture of
 *  the other, un-applied side.
 *
 *  Deletion classification (see spec Section 2 for the full reasoning):
 *  present locally + absent remotely + id in manifest -> remote lost it
 *  since last sync -> delete locally. Present remotely + absent locally +
 *  id in manifest -> this device deleted it since last sync -> delete
 *  remotely. Either side present + id NOT in manifest -> brand new, never
 *  synced before -> push or pull, never delete. */
async function reconcileTable(
  supabase: SupabaseClient,
  userId: string,
  table: SyncTableName,
  direction: Direction,
  manifestIds: Set<string>,
  sinceTs?: number,
): Promise<Set<string>> {
  const localRows = await getLocalRows(table);

  let query = supabase.from(REMOTE_TABLE[table]).select('*');
  if (sinceTs !== undefined) {
    query = query.gt(TIMESTAMP_COLUMN[table], new Date(sinceTs).toISOString());
  }
  const { data } = await query;
  const remoteRows = (data ?? []) as RemoteRow[];

  const localById = new Map(localRows.map((r) => [r.topicId, r]));
  const remoteById = new Map(remoteRows.map((r) => [r.topic_id as string, r]));

  const toPush: LocalRow[] = [];
  const toPull: RemoteRow[] = [];
  const remoteDeleteIds: string[] = [];
  const localDeleteIds: string[] = [];

  const allIds = new Set([...localById.keys(), ...remoteById.keys()]);
  for (const id of allIds) {
    const local = localById.get(id);
    const remote = remoteById.get(id);
    if (local && remote) {
      if (localTimestamp(table, local) > remoteTimestamp(table, remote)) toPush.push(local);
      else toPull.push(remote);
    } else if (local && !remote) {
      if (manifestIds.has(id)) localDeleteIds.push(id);
      else toPush.push(local);
    } else if (!local && remote) {
      if (manifestIds.has(id)) remoteDeleteIds.push(id);
      else toPull.push(remote);
    }
  }

  if (direction === 'push' || direction === 'full') {
    if (toPush.length > 0) {
      await supabase.from(REMOTE_TABLE[table]).upsert(toPush.map((r) => toRemoteRow(table, r, userId)));
    }
    if (remoteDeleteIds.length > 0) {
      await supabase.from(REMOTE_TABLE[table]).delete().in('topic_id', remoteDeleteIds);
    }
  }
  if (direction === 'pull' || direction === 'full') {
    if (toPull.length > 0) {
      await putRows(table, toPull.map((r) => fromRemoteRow(table, r)));
    }
    if (localDeleteIds.length > 0) {
      await deleteRows(table, localDeleteIds);
    }
  }

  const finalIds = new Set(allIds);
  for (const id of remoteDeleteIds) finalIds.delete(id);
  for (const id of localDeleteIds) finalIds.delete(id);
  return finalIds;
}

async function currentUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fullSync(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const userId = await currentUserId(supabase);
  if (!userId) return;

  const manifest = await getSyncManifest();
  const newTables = { progress: [], notes: [], favorites: [], srsCards: [] } as Record<SyncTableName, string[]>;

  for (const table of TABLES) {
    const manifestIds = new Set(manifest?.tables[table] ?? []);
    try {
      const finalIds = await reconcileTable(supabase, userId, table, 'full', manifestIds);
      newTables[table] = [...finalIds];
    } catch (error) {
      console.warn(`[sync] fullSync failed for ${table}:`, error);
      newTables[table] = [...manifestIds];
    }
  }

  await setSyncManifest({ id: 'manifest', tables: newTables, syncedAt: Date.now() });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- sync.test.ts` (from `kb-app/`)
Expected: PASS on every case. If a case fails, the most likely causes are: the deletion branches swapped back (re-check against the Global Constraints paragraph above, not intuition), or the mock query builder's `.select().gt()` chain not matching how `reconcileTable` calls it — adjust `makeTableMock` only if the real `reconcileTable` code's call shape genuinely differs from what the mock assumed, not the other way around.

- [ ] **Step 5: Full pipeline check and commit**

Run: `npm run typecheck && npm run lint && npm run test && npm run build` (from `kb-app/`)
Expected: all green.

```bash
git add kb-app/src/lib/sync.ts kb-app/src/lib/sync.test.ts
git commit -m "feat: add sync engine reconciliation core and fullSync()"
```

---

### Task 3: `sync.ts` — `pushDirty()` and `pullSince(ts)`

**Files:**
- Modify: `kb-app/src/lib/sync.ts`
- Test: `kb-app/src/lib/sync.test.ts`

**Interfaces:**
- Consumes: the `reconcileTable`, `currentUserId`, `TABLES` helpers already defined in Task 2's `sync.ts` (same file — no new imports needed beyond what Task 2 already added).
- Produces: `export async function pushDirty(): Promise<void>` and `export async function pullSince(ts: number): Promise<void>`, completing this file's full public surface per the Global Constraints.

- [ ] **Step 1: Write the failing tests**

Add to `kb-app/src/lib/sync.test.ts` (extend the top import line to also pull in `pullSince, pushDirty` from `./sync`, and add `Progress`/whatever else is already imported stays as-is):

```ts
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

  it('no-ops when there is no active session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(pullSince(0)).resolves.toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- sync.test.ts` (from `kb-app/`)
Expected: FAIL — `pushDirty`/`pullSince` are not exported yet.

- [ ] **Step 3: Implement**

Append to `kb-app/src/lib/sync.ts` (after `fullSync`):

```ts
export async function pushDirty(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const userId = await currentUserId(supabase);
  if (!userId) return;

  const manifest = await getSyncManifest();
  for (const table of TABLES) {
    try {
      await reconcileTable(supabase, userId, table, 'push', new Set(manifest?.tables[table] ?? []));
    } catch (error) {
      console.warn(`[sync] pushDirty failed for ${table}:`, error);
    }
  }
}

export async function pullSince(ts: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const userId = await currentUserId(supabase);
  if (!userId) return;

  const manifest = await getSyncManifest();
  for (const table of TABLES) {
    try {
      await reconcileTable(supabase, userId, table, 'pull', new Set(manifest?.tables[table] ?? []), ts);
    } catch (error) {
      console.warn(`[sync] pullSince failed for ${table}:`, error);
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- sync.test.ts` (from `kb-app/`)
Expected: PASS — every case in the file, including all of Task 2's.

- [ ] **Step 5: Full pipeline check and commit**

Run: `npm run typecheck && npm run lint && npm run test && npm run build` (from `kb-app/`)
Expected: all green.

```bash
git add kb-app/src/lib/sync.ts kb-app/src/lib/sync.test.ts
git commit -m "feat: add pushDirty() and pullSince(ts) to the sync engine"
```

---

## Definition of Done (whole plan)

- `kb-app/src/lib/sync.ts` exports exactly `pushDirty`, `pullSince`, `fullSync`, matching the Spec's Section 5 signatures.
- `kb-app/src/lib/db.ts` gains `SyncTableName`, `SyncManifest`, `putRows`, `deleteRows`, `getSyncManifest`, `setSyncManifest`, and the `syncMeta` store (`DB_VERSION` 4) — no existing export's behavior changes.
- All test cases from the spec's Testing section (and this plan's task tests) pass against mocks.
- No changes outside `kb-app/src/lib/db.ts`, `kb-app/src/lib/db.test.ts`, `kb-app/src/lib/sync.ts`, `kb-app/src/lib/sync.test.ts`.
- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- Manual end-to-end verification against a real Supabase project remains deferred (no project exists yet) — not a blocker, per the spec's Definition of Done.
