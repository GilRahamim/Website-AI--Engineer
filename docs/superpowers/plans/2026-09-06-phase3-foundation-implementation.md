# Phase 3 Sub-project 1 — Foundation + Progress + Favorites/Recents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user mark a topic's learning status (new/learning/mastered), star favorites, and see a "recently viewed" list — all persisted locally in IndexedDB, working fully offline, reflected in the sidebar/hero, and integrated into the existing filter system.

**Architecture:** A tiny `idb`-backed `src/lib/db.ts` persists three IndexedDB stores (`progress`, `favorites`, `recents`), each keyed by `topic.id`. A write-through Zustand store (`src/store/userDataStore.ts`, same shape as the existing `uiStore.ts`) holds the in-memory copy — every read is synchronous, every write updates the store first and persists to IndexedDB fire-and-forget. `TopicCard`/`TopicListRow` are restructured from a single `<Link>` into an outer `<div>` with a stretched inner `<Link>`, so the new status/favorite `<button>`s can sit as siblings instead of illegally nesting inside an `<a>`.

**Tech Stack:** React 19.2.7, TypeScript 6.0.3, Vite 8.1.5, Zustand v5, React Router v7, Vitest 4 + Testing Library (existing), `idb` (new), `fake-indexeddb` (new, dev).

**Spec:** `docs/superpowers/specs/2026-09-06-phase3-foundation-design.md`

## Global Constraints

- **Content is sacred** — never edit topic text/definitions/formulas; only structure, styling, interaction (`kb-app/CLAUDE.md` rule 1).
- **`topic.id` is the only key** for any user data (rule 2) — every IndexedDB record and Zustand map/set in this plan is keyed by it.
- **Local-first** — never block UI on storage. Every `db.ts` function catches its own errors, warns once, and returns a safe default; `userDataStore` never gets stuck at `isLoaded: false` (rule 3).
- **User data → IndexedDB only** — no heavy data in localStorage (rule 4).
- **RTL + both themes must work on every new screen** — verify manually in both (rule 5).
- **Accessibility is required, not optional**: `focus-visible`, full keyboard nav, AA contrast, `prefers-reduced-motion`, ≥44px touch targets (rule 6). This is the whole reason Task 4 restructures the card components — nesting `<button>`s inside an `<a>` is invalid HTML and breaks assistive tech.
- **Colors only via `--kb-*` OKLCH tokens** (rule 7) — no hardcoded colors in any new CSS/component.
- No `console.error` anywhere (Definition of Done) — storage failures use `console.warn`, once per session.
- Definition of Done for the whole sub-project: `npm run typecheck && npm run lint && npm run test && npm run build` all green, plus manual check in light/dark/RTL/mobile/keyboard-only (see spec's Definition of Done for the full manual checklist).
- Every command below runs with `kb-app/` as the working directory.

---

## File Structure

```
kb-app/src/
├─ types.ts                                  # Task 1 (modify) — ProgressStatus/Progress/Favorite/Recent/FilterState
├─ setupTests.ts                             # Task 1 (modify) — fake-indexeddb/auto
├─ lib/
│  ├─ progressStatus.ts                      # Task 1 (new) — shared labels/glyphs/cycle order
│  ├─ db.ts                                  # Task 1 (new) — IndexedDB wrapper
│  └─ filterTopics.ts                        # Task 8 (modify) — status filter
├─ store/
│  ├─ userDataStore.ts                       # Task 2 (new)
│  └─ uiStore.ts                             # Task 8 (modify) — selectedStatuses/toggleStatus
├─ components/
│  ├─ topic/
│  │  ├─ TopicStatusButton.tsx               # Task 3 (new)
│  │  └─ TopicFavoriteButton.tsx             # Task 3 (new)
│  ├─ browse/
│  │  ├─ TopicCard.tsx                       # Task 4 (modify) — stretched-link restructure
│  │  ├─ TopicListRow.tsx                    # Task 4 (modify) — stretched-link restructure
│  │  └─ FilterChips.tsx                     # Task 8 (modify) — status chips
│  ├─ layout/
│  │  ├─ Sidebar.tsx                         # Task 6 (modify) — favorites/recents/progress bars
│  │  └─ Hero.tsx                            # Task 7 (modify) — mastered stat card
│  └─ reader/
│     └─ TopicReader.tsx                     # Task 5 (modify)
├─ pages/
│  ├─ Reader.tsx                             # Task 5 (modify) — recordView
│  └─ Home.tsx                               # Task 6, 7, 8 (modify, incrementally)
├─ App.tsx                                   # Task 2 (modify) — loadUserData on mount
└─ styles/
   └─ index.css                              # Task 3, 4 (modify)
```

---

### Task 1: Types + shared progress-status constants + `db.ts` + test tooling

**Files:**
- Modify: `kb-app/package.json` (via `npm install`)
- Modify: `kb-app/src/types.ts`
- Modify: `kb-app/src/setupTests.ts`
- Create: `kb-app/src/lib/progressStatus.ts`
- Create: `kb-app/src/lib/progressStatus.test.ts`
- Create: `kb-app/src/lib/db.ts`
- Create: `kb-app/src/lib/db.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ProgressStatus`, `Progress`, `Favorite`, `Recent` types (`types.ts`); `STATUS_LABELS`, `STATUS_GLYPHS`, `NEXT_STATUS`, `ALL_STATUSES` (`lib/progressStatus.ts`); `getAllProgress()`, `setProgress(topicId, status)`, `getAllFavorites()`, `toggleFavorite(topicId)`, `getAllRecents()`, `recordView(topicId)`, `__resetDbForTests()` (`lib/db.ts`). Every later task imports these by these exact names.

- [ ] **Step 1: Install dependencies**

Run: `npm install idb`
Run: `npm install -D fake-indexeddb`

- [ ] **Step 2: Add the new types**

In `src/types.ts`, add after the existing `Category` type and before `Topic`... actually order doesn't matter; append these after the `TopicGroup` interface at the end of the file:

```ts
export type ProgressStatus = 'new' | 'learning' | 'mastered';

export interface Progress {
  topicId: string;
  status: ProgressStatus;
  updatedAt: number;
}

export interface Favorite {
  topicId: string;
  createdAt: number;
}

export interface Recent {
  topicId: string;
  viewedAt: number;
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Write the failing test for `progressStatus.ts`**

Create `src/lib/progressStatus.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ALL_STATUSES, NEXT_STATUS, STATUS_GLYPHS, STATUS_LABELS } from './progressStatus';

describe('progressStatus', () => {
  it('lists all three statuses', () => {
    expect(ALL_STATUSES).toEqual(['new', 'learning', 'mastered']);
  });

  it('defines a non-empty label and glyph for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_GLYPHS[status]).toBeTruthy();
    }
  });

  it('cycles new -> learning -> mastered -> new', () => {
    expect(NEXT_STATUS.new).toBe('learning');
    expect(NEXT_STATUS.learning).toBe('mastered');
    expect(NEXT_STATUS.mastered).toBe('new');
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `npm run test -- progressStatus`
Expected: FAIL — module not found.

- [ ] **Step 6: Implement `src/lib/progressStatus.ts`**

```ts
import type { ProgressStatus } from '../types';

export const ALL_STATUSES: ProgressStatus[] = ['new', 'learning', 'mastered'];

export const STATUS_LABELS: Record<ProgressStatus, string> = {
  new: 'חדש',
  learning: 'בלמידה',
  mastered: 'נשלט',
};

export const STATUS_GLYPHS: Record<ProgressStatus, string> = {
  new: '○',
  learning: '◐',
  mastered: '●',
};

export const NEXT_STATUS: Record<ProgressStatus, ProgressStatus> = {
  new: 'learning',
  learning: 'mastered',
  mastered: 'new',
};
```

- [ ] **Step 7: Run to verify it passes**

Run: `npm run test -- progressStatus`
Expected: PASS (3 tests).

- [ ] **Step 8: Register fake-indexeddb globally for tests**

Modify `src/setupTests.ts` — add the import as the very first line (before the jest-dom import), so every test file gets a working `indexedDB`/`IDBKeyRange` global without per-file setup:

```ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia. Provide a default stub so any code
// that reads it (src/lib/theme.ts) doesn't crash in tests that don't care
// about system-theme behavior. Tests that DO care override this per-test.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}
```

- [ ] **Step 9: Write the failing tests for `db.ts`**

Create `src/lib/db.test.ts`:

```ts
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
        // eslint-disable-next-line no-await-in-loop -- sequential writes needed so viewedAt ordering is deterministic
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
```

- [ ] **Step 10: Run to verify it fails**

Run: `npm run test -- db.test`
Expected: FAIL — module not found.

- [ ] **Step 11: Implement `src/lib/db.ts`**

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Favorite, Progress, ProgressStatus, Recent } from '../types';

interface KbUserDataSchema extends DBSchema {
  progress: { key: string; value: Progress };
  favorites: { key: string; value: Favorite };
  recents: { key: string; value: Recent };
}

const DB_NAME = 'kb-user-data';
const DB_VERSION = 1;
const RECENTS_LIMIT = 12;

let warned = false;
function warnOnce(context: string, error: unknown): void {
  if (warned) return;
  warned = true;
  console.warn(`[db] IndexedDB unavailable, continuing in-memory only (${context}):`, error);
}

let dbPromise: Promise<IDBPDatabase<KbUserDataSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<KbUserDataSchema>> {
  if (!dbPromise) {
    // Structured so a future version bump (Phase 3's notes/SRS sub-projects,
    // or Phase 5's sync metadata) only ever needs a new `if` branch here —
    // never a rewrite of the stores created by earlier versions.
    dbPromise = openDB<KbUserDataSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'topicId' });
        }
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'topicId' });
        }
        if (!db.objectStoreNames.contains('recents')) {
          db.createObjectStore('recents', { keyPath: 'topicId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllProgress(): Promise<Progress[]> {
  try {
    const db = await getDb();
    return await db.getAll('progress');
  } catch (error) {
    warnOnce('getAllProgress', error);
    return [];
  }
}

export async function setProgress(topicId: string, status: ProgressStatus): Promise<void> {
  try {
    const db = await getDb();
    await db.put('progress', { topicId, status, updatedAt: Date.now() });
  } catch (error) {
    warnOnce('setProgress', error);
  }
}

export async function getAllFavorites(): Promise<Favorite[]> {
  try {
    const db = await getDb();
    return await db.getAll('favorites');
  } catch (error) {
    warnOnce('getAllFavorites', error);
    return [];
  }
}

export async function toggleFavorite(topicId: string): Promise<void> {
  try {
    const db = await getDb();
    const existing = await db.get('favorites', topicId);
    if (existing) {
      await db.delete('favorites', topicId);
    } else {
      await db.put('favorites', { topicId, createdAt: Date.now() });
    }
  } catch (error) {
    warnOnce('toggleFavorite', error);
  }
}

export async function getAllRecents(): Promise<Recent[]> {
  try {
    const db = await getDb();
    const all = await db.getAll('recents');
    return all.sort((a, b) => b.viewedAt - a.viewedAt).slice(0, RECENTS_LIMIT);
  } catch (error) {
    warnOnce('getAllRecents', error);
    return [];
  }
}

export async function recordView(topicId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.put('recents', { topicId, viewedAt: Date.now() });
  } catch (error) {
    warnOnce('recordView', error);
  }
}

/** Test-only: clears the memoized connection and the warn-once flag so each
 *  test starts from a clean slate. Not used by application code. */
export function __resetDbForTests(): void {
  dbPromise = null;
  warned = false;
}
```

- [ ] **Step 12: Run to verify it passes**

Run: `npm run test -- db.test`
Expected: PASS (9 tests). If the failure-handling test doesn't trigger `warnOnce` as expected, check whether `openDB` throws synchronously or returns a rejected promise in the installed `idb` version — both are caught by the `try/catch` in each exported function either way, but the exact assertion may need a small adjustment (e.g. `indexedDB.open` may need to return a request-like object that errors asynchronously instead of throwing synchronously — adjust the mock to match, not the production code).

- [ ] **Step 13: Full verification**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all PASS.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json src/types.ts src/setupTests.ts src/lib/progressStatus.ts src/lib/progressStatus.test.ts src/lib/db.ts src/lib/db.test.ts
git commit -m "feat: IndexedDB user-data foundation (progress/favorites/recents stores)"
```

---

### Task 2: `userDataStore.ts` + app-level load wiring

**Files:**
- Create: `kb-app/src/store/userDataStore.ts`
- Create: `kb-app/src/store/userDataStore.test.ts`
- Modify: `kb-app/src/App.tsx`

**Interfaces:**
- Consumes: `ProgressStatus` from `../types`; `NEXT_STATUS` from `../lib/progressStatus` (Task 1); `getAllProgress`, `setProgress`, `getAllFavorites`, `toggleFavorite`, `getAllRecents`, `recordView` from `../lib/db` (Task 1).
- Produces: `useUserDataStore` Zustand hook with state `progress: Map<string, ProgressStatus>`, `favorites: Set<string>`, `recents: {topicId: string; viewedAt: number}[]`, `isLoaded: boolean` and actions `loadUserData(): Promise<void>`, `setStatus(topicId, status)`, `cycleStatus(topicId)`, `toggleFavorite(topicId)`, `recordView(topicId)`. Every component from Task 3 onward reads/writes this store by these exact names.

- [ ] **Step 1: Write the failing tests**

Create `src/store/userDataStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserDataStore } from './userDataStore';
import * as db from '../lib/db';

function resetStore() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    isLoaded: false,
  });
}

describe('userDataStore', () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  describe('cycleStatus', () => {
    it('cycles new -> learning -> mastered -> new (missing record defaults to new)', () => {
      const { cycleStatus } = useUserDataStore.getState();
      cycleStatus('topic-a');
      expect(useUserDataStore.getState().progress.get('topic-a')).toBe('learning');
      cycleStatus('topic-a');
      expect(useUserDataStore.getState().progress.get('topic-a')).toBe('mastered');
      cycleStatus('topic-a');
      expect(useUserDataStore.getState().progress.get('topic-a')).toBe('new');
    });

    it('updates state synchronously and persists via db.setProgress without the caller awaiting it', () => {
      const setProgressSpy = vi.spyOn(db, 'setProgress').mockResolvedValue(undefined);
      useUserDataStore.getState().cycleStatus('topic-a');
      expect(useUserDataStore.getState().progress.get('topic-a')).toBe('learning');
      expect(setProgressSpy).toHaveBeenCalledWith('topic-a', 'learning');
    });
  });

  describe('toggleFavorite', () => {
    it('adds then removes a favorite', () => {
      const { toggleFavorite } = useUserDataStore.getState();
      toggleFavorite('topic-a');
      expect(useUserDataStore.getState().favorites.has('topic-a')).toBe(true);
      toggleFavorite('topic-a');
      expect(useUserDataStore.getState().favorites.has('topic-a')).toBe(false);
    });

    it('the most recently favorited topic iterates first', () => {
      const { toggleFavorite } = useUserDataStore.getState();
      toggleFavorite('topic-a');
      toggleFavorite('topic-b');
      expect([...useUserDataStore.getState().favorites]).toEqual(['topic-b', 'topic-a']);
    });

    it('persists via db.toggleFavorite without the caller awaiting it', () => {
      const toggleFavoriteSpy = vi.spyOn(db, 'toggleFavorite').mockResolvedValue(undefined);
      useUserDataStore.getState().toggleFavorite('topic-a');
      expect(toggleFavoriteSpy).toHaveBeenCalledWith('topic-a');
    });
  });

  describe('recordView', () => {
    it('adds a recent entry, moving repeat views to the front without duplicating', () => {
      const { recordView } = useUserDataStore.getState();
      recordView('topic-a');
      recordView('topic-b');
      recordView('topic-a');
      expect(useUserDataStore.getState().recents.map((r) => r.topicId)).toEqual(['topic-a', 'topic-b']);
    });

    it('persists via db.recordView without the caller awaiting it', () => {
      const recordViewSpy = vi.spyOn(db, 'recordView').mockResolvedValue(undefined);
      useUserDataStore.getState().recordView('topic-a');
      expect(recordViewSpy).toHaveBeenCalledWith('topic-a');
    });
  });

  describe('loadUserData', () => {
    it('populates progress, favorites (newest-createdAt-first) and recents, and sets isLoaded', async () => {
      vi.spyOn(db, 'getAllProgress').mockResolvedValue([
        { topicId: 'topic-a', status: 'mastered', updatedAt: 1 },
      ]);
      vi.spyOn(db, 'getAllFavorites').mockResolvedValue([
        { topicId: 'topic-b', createdAt: 1 },
        { topicId: 'topic-c', createdAt: 2 },
      ]);
      vi.spyOn(db, 'getAllRecents').mockResolvedValue([{ topicId: 'topic-a', viewedAt: 1 }]);

      await useUserDataStore.getState().loadUserData();

      const state = useUserDataStore.getState();
      expect(state.progress.get('topic-a')).toBe('mastered');
      expect([...state.favorites]).toEqual(['topic-c', 'topic-b']);
      expect(state.recents).toEqual([{ topicId: 'topic-a', viewedAt: 1 }]);
      expect(state.isLoaded).toBe(true);
    });

    it('sets isLoaded true even when the underlying db calls resolve with empty defaults', async () => {
      vi.spyOn(db, 'getAllProgress').mockResolvedValue([]);
      vi.spyOn(db, 'getAllFavorites').mockResolvedValue([]);
      vi.spyOn(db, 'getAllRecents').mockResolvedValue([]);

      await useUserDataStore.getState().loadUserData();
      expect(useUserDataStore.getState().isLoaded).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- userDataStore`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/store/userDataStore.ts`**

```ts
import { create } from 'zustand';
import type { ProgressStatus } from '../types';
import { NEXT_STATUS } from '../lib/progressStatus';
import {
  getAllFavorites,
  getAllProgress,
  getAllRecents,
  recordView as persistRecordView,
  setProgress as persistSetProgress,
  toggleFavorite as persistToggleFavorite,
} from '../lib/db';

interface RecentEntry {
  topicId: string;
  viewedAt: number;
}

interface UserDataState {
  progress: Map<string, ProgressStatus>;
  favorites: Set<string>;
  recents: RecentEntry[];
  isLoaded: boolean;

  loadUserData: () => Promise<void>;
  setStatus: (topicId: string, status: ProgressStatus) => void;
  cycleStatus: (topicId: string) => void;
  toggleFavorite: (topicId: string) => void;
  recordView: (topicId: string) => void;
}

const RECENTS_LIMIT = 12;

export const useUserDataStore = create<UserDataState>()((set, get) => ({
  progress: new Map(),
  favorites: new Set(),
  recents: [],
  isLoaded: false,

  loadUserData: async () => {
    try {
      const [progressRows, favoriteRows, recentRows] = await Promise.all([
        getAllProgress(),
        getAllFavorites(),
        getAllRecents(),
      ]);
      const favoritesNewestFirst = [...favoriteRows].sort((a, b) => b.createdAt - a.createdAt);
      set({
        progress: new Map(progressRows.map((row) => [row.topicId, row.status])),
        favorites: new Set(favoritesNewestFirst.map((row) => row.topicId)),
        recents: recentRows.map((row) => ({ topicId: row.topicId, viewedAt: row.viewedAt })),
        isLoaded: true,
      });
    } catch {
      // getAllProgress/getAllFavorites/getAllRecents already catch their own
      // errors and resolve with safe defaults — this only guards Promise.all's
      // own plumbing, so isLoaded still settles true either way.
      set({ isLoaded: true });
    }
  },

  setStatus: (topicId, status) => {
    set((state) => {
      const next = new Map(state.progress);
      next.set(topicId, status);
      return { progress: next };
    });
    void persistSetProgress(topicId, status);
  },

  cycleStatus: (topicId) => {
    const current = get().progress.get(topicId) ?? 'new';
    get().setStatus(topicId, NEXT_STATUS[current]);
  },

  toggleFavorite: (topicId) => {
    set((state) => {
      if (state.favorites.has(topicId)) {
        const next = new Set(state.favorites);
        next.delete(topicId);
        return { favorites: next };
      }
      // Prepend rather than append: a Set iterates in insertion order, and we
      // want the newest favorite first, matching loadUserData's ordering.
      return { favorites: new Set([topicId, ...state.favorites]) };
    });
    void persistToggleFavorite(topicId);
  },

  recordView: (topicId) => {
    set((state) => {
      const withoutTopic = state.recents.filter((r) => r.topicId !== topicId);
      return { recents: [{ topicId, viewedAt: Date.now() }, ...withoutTopic].slice(0, RECENTS_LIMIT) };
    });
    void persistRecordView(topicId);
  },
}));
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- userDataStore`
Expected: PASS (9 tests).

- [ ] **Step 5: Wire `loadUserData` into app startup**

Modify `src/App.tsx`:

```tsx
import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';
import { useUserDataStore } from './store/userDataStore';

export default function App() {
  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/topic/:id" element={<Reader />} />
    </Routes>
  );
}
```

`App` mounts once for the whole session (React Router swaps its `Routes` children, not `App` itself), so this `useEffect` with an empty dependency array runs exactly once regardless of navigation.

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all PASS. (`App.test.tsx` already renders `<App>` for both routes and doesn't mock `userDataStore`, so `loadUserData` will run for real against fake-indexeddb — this should be harmless and fast, but if it makes those tests noisy/slow, that's an acceptable, expected side effect of this task, not a regression to fix here.)

- [ ] **Step 7: Commit**

```bash
git add src/store/userDataStore.ts src/store/userDataStore.test.ts src/App.tsx
git commit -m "feat: write-through userDataStore over the IndexedDB foundation"
```

---

### Task 3: Shared `TopicStatusButton` / `TopicFavoriteButton` components

**Files:**
- Create: `kb-app/src/components/topic/TopicStatusButton.tsx`
- Create: `kb-app/src/components/topic/TopicStatusButton.test.tsx`
- Create: `kb-app/src/components/topic/TopicFavoriteButton.tsx`
- Create: `kb-app/src/components/topic/TopicFavoriteButton.test.tsx`
- Modify: `kb-app/src/styles/index.css`

**Interfaces:**
- Consumes: `useUserDataStore` (Task 2); `STATUS_GLYPHS`, `STATUS_LABELS`, `NEXT_STATUS` from `../../lib/progressStatus` (Task 1).
- Produces: default-exported `TopicStatusButton({ topicId, size? })` and `TopicFavoriteButton({ topicId, size? })`, `size?: 'sm' | 'lg'` (default `'sm'`). Consumed by `TopicCard`/`TopicListRow` (Task 4) and `TopicReader` (Task 5).

- [ ] **Step 1: Write the failing tests for `TopicStatusButton`**

Create `src/components/topic/TopicStatusButton.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicStatusButton from './TopicStatusButton';
import { useUserDataStore } from '../../store/userDataStore';

function reset() {
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
}

describe('TopicStatusButton', () => {
  beforeEach(reset);

  it('defaults to "new" and describes the current and next state in its accessible name', () => {
    render(<TopicStatusButton topicId="topic-a" />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/חדש/);
  });

  it('cycles the status in the store on each click', async () => {
    const user = userEvent.setup();
    render(<TopicStatusButton topicId="topic-a" />);
    const button = screen.getByRole('button');

    await user.click(button);
    expect(useUserDataStore.getState().progress.get('topic-a')).toBe('learning');
    await user.click(button);
    expect(useUserDataStore.getState().progress.get('topic-a')).toBe('mastered');
    await user.click(button);
    expect(useUserDataStore.getState().progress.get('topic-a')).toBe('new');
  });

  it('does not let its click reach an ancestor click handler', async () => {
    const user = userEvent.setup();
    const onAncestorClick = vi.fn();
    render(
      <div onClick={onAncestorClick}>
        <TopicStatusButton topicId="topic-a" />
      </div>,
    );
    await user.click(screen.getByRole('button'));
    expect(onAncestorClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- TopicStatusButton`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/topic/TopicStatusButton.tsx`**

```tsx
import { useUserDataStore } from '../../store/userDataStore';
import { NEXT_STATUS, STATUS_GLYPHS, STATUS_LABELS } from '../../lib/progressStatus';

interface TopicStatusButtonProps {
  topicId: string;
  size?: 'sm' | 'lg';
}

export default function TopicStatusButton({ topicId, size = 'sm' }: TopicStatusButtonProps) {
  const status = useUserDataStore((s) => s.progress.get(topicId) ?? 'new');
  const cycleStatus = useUserDataStore((s) => s.cycleStatus);

  return (
    <button
      type="button"
      onClick={(event) => {
        // Defensive — TopicCard/TopicListRow (Task 4) render this as a
        // sibling of the topic link, not a descendant, so there is normally
        // nothing above it to stop; kept in case a future layout nests it.
        event.preventDefault();
        event.stopPropagation();
        cycleStatus(topicId);
      }}
      aria-label={`מצב למידה: ${STATUS_LABELS[status]}. לחץ למעבר ל'${STATUS_LABELS[NEXT_STATUS[status]]}'`}
      data-status={status}
      className={`kb-status-pill grid place-items-center rounded-full border border-[var(--kb-border)] bg-[var(--kb-surface)] ${
        size === 'lg' ? 'size-12 text-2xl' : 'size-11 text-base'
      }`}
    >
      <span aria-hidden="true">{STATUS_GLYPHS[status]}</span>
    </button>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- TopicStatusButton`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing tests for `TopicFavoriteButton`**

Create `src/components/topic/TopicFavoriteButton.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicFavoriteButton from './TopicFavoriteButton';
import { useUserDataStore } from '../../store/userDataStore';

function reset() {
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
}

describe('TopicFavoriteButton', () => {
  beforeEach(reset);

  it('renders unfavorited by default with aria-pressed=false', () => {
    render(<TopicFavoriteButton topicId="topic-a" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles favorite state in the store on click, reflected via aria-pressed', async () => {
    const user = userEvent.setup();
    render(<TopicFavoriteButton topicId="topic-a" />);
    const button = screen.getByRole('button');

    await user.click(button);
    expect(useUserDataStore.getState().favorites.has('topic-a')).toBe(true);
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await user.click(button);
    expect(useUserDataStore.getState().favorites.has('topic-a')).toBe(false);
  });

  it('does not let its click reach an ancestor click handler', async () => {
    const user = userEvent.setup();
    const onAncestorClick = vi.fn();
    render(
      <div onClick={onAncestorClick}>
        <TopicFavoriteButton topicId="topic-a" />
      </div>,
    );
    await user.click(screen.getByRole('button'));
    expect(onAncestorClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm run test -- TopicFavoriteButton`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `src/components/topic/TopicFavoriteButton.tsx`**

```tsx
import { useUserDataStore } from '../../store/userDataStore';

interface TopicFavoriteButtonProps {
  topicId: string;
  size?: 'sm' | 'lg';
}

export default function TopicFavoriteButton({ topicId, size = 'sm' }: TopicFavoriteButtonProps) {
  const isFavorite = useUserDataStore((s) => s.favorites.has(topicId));
  const toggleFavorite = useUserDataStore((s) => s.toggleFavorite);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(topicId);
      }}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
      className={`kb-favorite-star grid place-items-center rounded-full border border-[var(--kb-border)] bg-[var(--kb-surface)] ${
        size === 'lg' ? 'size-12 text-2xl' : 'size-11 text-base'
      }`}
    >
      <span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>
    </button>
  );
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm run test -- TopicFavoriteButton`
Expected: PASS (3 tests).

- [ ] **Step 9: Add shared CSS**

Append to `src/styles/index.css`:

```css
.kb-status-pill,
.kb-favorite-star {
  /* position:relative + a positive z-index is required so these controls
     paint above the stretched-link overlay introduced in Task 4 and stay
     independently clickable. */
  position: relative;
  z-index: 1;
  color: var(--kb-text2);
}
.kb-status-pill:hover,
.kb-favorite-star:hover {
  background: var(--kb-surface2);
}
.kb-status-pill[data-status='learning'] {
  color: var(--kb-accent);
}
.kb-status-pill[data-status='mastered'] {
  color: var(--kb-accent);
  background: var(--kb-accent-soft);
}
.kb-favorite-star[aria-pressed='true'] {
  color: var(--kb-accent);
}
```

- [ ] **Step 10: Full verification**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
git add src/components/topic/TopicStatusButton.tsx src/components/topic/TopicStatusButton.test.tsx src/components/topic/TopicFavoriteButton.tsx src/components/topic/TopicFavoriteButton.test.tsx src/styles/index.css
git commit -m "feat: TopicStatusButton + TopicFavoriteButton shared controls"
```

---

### Task 4: Restructure `TopicCard`/`TopicListRow` to the stretched-link pattern

**Files:**
- Modify: `kb-app/src/components/browse/TopicCard.tsx`
- Modify: `kb-app/src/components/browse/TopicListRow.tsx`
- Modify: `kb-app/src/components/browse/TopicCard.test.tsx`
- Modify: `kb-app/src/styles/index.css`

**Interfaces:**
- Consumes: `TopicStatusButton`, `TopicFavoriteButton` (Task 3).
- Produces: unchanged public props (`{ topic, highlightTerm, itemProps }`) — this task only changes internal DOM structure and adds the two new controls. `TopicGrid`/`AccordionGroup` (unchanged, Phase 2) keep working with no prop changes.

Why: `TopicCard`/`TopicListRow` are currently a single `<Link>` (`<a>`) element each. Nesting `<button>`s inside an `<a>` is invalid HTML and breaks assistive tech, so the outer element becomes a `<div>` with a header row (chip + status + favorite, as siblings) and an inner `<Link>` wrapping the title/definition, expanded to cover the whole card via a transparent `::after` overlay (the "stretched link" pattern) so click-anywhere-to-open still works.

- [ ] **Step 1: Implement the restructured `TopicCard.tsx`**

Replace `src/components/browse/TopicCard.tsx` entirely:

```tsx
import { Link } from 'react-router-dom';
import type { Topic } from '../../types';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import { highlightMatch } from '../../lib/highlightMatch';
import TopicStatusButton from '../topic/TopicStatusButton';
import TopicFavoriteButton from '../topic/TopicFavoriteButton';

interface TopicCardProps {
  topic: Topic;
  highlightTerm: string;
  itemProps: GridItemProps;
}

export default function TopicCard({ topic, highlightTerm, itemProps }: TopicCardProps) {
  const titleSegments = highlightMatch(topic.title, highlightTerm);

  /* eslint-disable react-hooks/refs -- itemProps.ref is a plain callback-ref forwarded from
     useGridKeyboardNav's roving-tabindex GridItemProps, never a ref.current read; the rule's
     name-based heuristic misidentifies the whole itemProps object because it has a property
     literally named "ref". */
  return (
    <div className="kb-topic-card relative flex flex-col gap-2 p-4 transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]">
      <div className="flex items-center justify-between gap-2">
        <span className="kb-category-chip" data-category={topic.category}>
          {topic.category_label}
        </span>
        <div className="flex items-center gap-1">
          <TopicStatusButton topicId={topic.id} />
          <TopicFavoriteButton topicId={topic.id} />
        </div>
      </div>
      <Link
        to={`/topic/${encodeURIComponent(topic.id)}`}
        ref={itemProps.ref}
        tabIndex={itemProps.tabIndex}
        onFocus={itemProps.onFocus}
        onKeyDown={itemProps.onKeyDown}
        className="kb-stretched-link flex flex-col gap-2"
      >
        <h3 className="text-base font-bold text-[var(--kb-text)]">
          {titleSegments.map((segment, i) =>
            segment.match ? (
              <mark key={i} className="bg-[var(--kb-accent-soft)] text-[var(--kb-text)]">
                {segment.text}
              </mark>
            ) : (
              <span key={i}>{segment.text}</span>
            ),
          )}
        </h3>
        <p className="text-sm text-[var(--kb-muted)] line-clamp-3">{topic.definition}</p>
      </Link>
    </div>
  );
  /* eslint-enable react-hooks/refs */
}
```

- [ ] **Step 2: Implement the restructured `TopicListRow.tsx`**

Replace `src/components/browse/TopicListRow.tsx` entirely:

```tsx
import { Link } from 'react-router-dom';
import type { Topic } from '../../types';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import { highlightMatch } from '../../lib/highlightMatch';
import TopicStatusButton from '../topic/TopicStatusButton';
import TopicFavoriteButton from '../topic/TopicFavoriteButton';

interface TopicListRowProps {
  topic: Topic;
  highlightTerm: string;
  itemProps: GridItemProps;
}

export default function TopicListRow({ topic, highlightTerm, itemProps }: TopicListRowProps) {
  const titleSegments = highlightMatch(topic.title, highlightTerm);

  /* eslint-disable react-hooks/refs -- see TopicCard.tsx for rationale */
  return (
    <div className="kb-topic-list-row relative flex min-h-11 items-center gap-3 px-4 py-2 transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]">
      <span className="kb-category-chip shrink-0" data-category={topic.category}>
        {topic.category_label}
      </span>
      <Link
        to={`/topic/${encodeURIComponent(topic.id)}`}
        ref={itemProps.ref}
        tabIndex={itemProps.tabIndex}
        onFocus={itemProps.onFocus}
        onKeyDown={itemProps.onKeyDown}
        className="kb-stretched-link flex flex-1 items-center gap-3 overflow-hidden"
      >
        <span className="font-semibold text-[var(--kb-text)]">
          {titleSegments.map((segment, i) =>
            segment.match ? (
              <mark key={i} className="bg-[var(--kb-accent-soft)] text-[var(--kb-text)]">
                {segment.text}
              </mark>
            ) : (
              <span key={i}>{segment.text}</span>
            ),
          )}
        </span>
        <span className="truncate text-sm text-[var(--kb-muted)]">{topic.definition}</span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <TopicStatusButton topicId={topic.id} />
        <TopicFavoriteButton topicId={topic.id} />
      </div>
    </div>
  );
  /* eslint-enable react-hooks/refs */
}
```

- [ ] **Step 3: Update the CSS for the new structure**

In `src/styles/index.css`, replace the existing `.kb-topic-card`/`.kb-topic-list-row` block:

```css
.kb-topic-card,
.kb-topic-list-row {
  display: block;
  border-radius: 12px;
  border: 1px solid var(--kb-border);
  background: var(--kb-surface);
  box-shadow: var(--kb-shadow-sm);
  text-decoration: none;
  color: inherit;
}
.kb-topic-card:hover,
.kb-topic-list-row:hover {
  transform: translateY(-2px);
  box-shadow: var(--kb-shadow-md);
}
.kb-topic-card:focus-visible,
.kb-topic-list-row:focus-visible {
  transform: translateY(-2px);
  box-shadow: var(--kb-focus-ring), var(--kb-shadow-md);
}
```

with:

```css
.kb-topic-card,
.kb-topic-list-row {
  display: block;
  border-radius: 12px;
  border: 1px solid var(--kb-border);
  background: var(--kb-surface);
  box-shadow: var(--kb-shadow-sm);
}
.kb-topic-card:hover,
.kb-topic-list-row:hover {
  transform: translateY(-2px);
  box-shadow: var(--kb-shadow-md);
}
/* Focus now lands on the inner .kb-stretched-link <a>, not this outer div. */
.kb-topic-card:has(a:focus-visible),
.kb-topic-list-row:has(a:focus-visible) {
  transform: translateY(-2px);
  box-shadow: var(--kb-focus-ring), var(--kb-shadow-md);
}

.kb-stretched-link {
  text-decoration: none;
  color: inherit;
}
.kb-stretched-link::after {
  content: '';
  position: absolute;
  inset: 0;
}
```

- [ ] **Step 4: Update and extend `TopicCard.test.tsx`**

Replace `src/components/browse/TopicCard.test.tsx` entirely:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TopicCard from './TopicCard';
import TopicListRow from './TopicListRow';
import { useUserDataStore } from '../../store/userDataStore';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import type { Topic } from '../../types';

const topic: Topic = {
  id: 'Intro to Data Science::algorithms::02_Linear_Regression.docx',
  module: 'Intro to Data Science',
  module_label: 'מבוא',
  category: 'algorithms',
  category_label: 'אלגוריתמים',
  num: 2,
  slug_name: 'Linear Regression',
  title: 'Linear Regression — רגרסיה לינארית',
  definition: 'שיטת למידה מונחית לחיזוי ערך רציף.',
  related_raw: [],
  related_match: [],
  contentPath: '/topic-content/x.html',
};

const itemProps: GridItemProps = {
  tabIndex: 0,
  ref: () => {},
  onFocus: () => {},
  onKeyDown: () => {},
};

function reset() {
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('TopicCard', () => {
  beforeEach(reset);

  it('links to the topic reader route with an encoded id', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/topic/${encodeURIComponent(topic.id)}`);
  });

  it('renders the category label and definition', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />);
    expect(screen.getByText('אלגוריתמים')).toBeInTheDocument();
    expect(screen.getByText(topic.definition)).toBeInTheDocument();
  });

  it('highlights the search term in the title', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="Linear" itemProps={itemProps} />);
    expect(screen.getByText('Linear')).toBeInTheDocument();
  });

  it('applies keyboard-nav props from the item to the link', () => {
    const onKeyDown = vi.fn();
    renderWithRouter(
      <TopicCard topic={topic} highlightTerm="" itemProps={{ ...itemProps, tabIndex: -1, onKeyDown }} />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('tabindex', '-1');
  });

  it('renders the status and favorite buttons as siblings of the link, not nested inside it', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />);
    const link = screen.getByRole('link');
    const statusButton = screen.getByRole('button', { name: /מצב למידה/ });
    const favoriteButton = screen.getByRole('button', { name: /מועדפים/ });
    expect(link.contains(statusButton)).toBe(false);
    expect(link.contains(favoriteButton)).toBe(false);
  });

  it('clicking the status or favorite button does not navigate to the topic route', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />} />
          <Route path="/topic/:id" element={<p>Reader page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /מצב למידה/ }));
    expect(screen.queryByText('Reader page')).not.toBeInTheDocument();
  });
});

describe('TopicListRow', () => {
  beforeEach(reset);

  it('links to the topic reader route and shows the title', () => {
    renderWithRouter(<TopicListRow topic={topic} highlightTerm="" itemProps={itemProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/topic/${encodeURIComponent(topic.id)}`);
    expect(link).toHaveTextContent('Linear Regression');
  });

  it('renders the status and favorite buttons as siblings of the link, not nested inside it', () => {
    renderWithRouter(<TopicListRow topic={topic} highlightTerm="" itemProps={itemProps} />);
    const link = screen.getByRole('link');
    const statusButton = screen.getByRole('button', { name: /מצב למידה/ });
    expect(link.contains(statusButton)).toBe(false);
  });
});
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- TopicCard`
Expected: PASS (all tests, including the new ones).

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all PASS (`npm run build` in particular confirms the `:has()` CSS selector and the Tailwind classes compile cleanly).

- [ ] **Step 7: Manual check (not testable in jsdom)**

Run `npm run dev`, open the home page, and confirm: the whole card is still clickable outside the two buttons, in both grid and list view, in light and dark theme, with RTL layout — this is the one part of the stretched-link pattern (z-index stacking) that jsdom's layout engine can't verify.

- [ ] **Step 8: Commit**

```bash
git add src/components/browse/TopicCard.tsx src/components/browse/TopicListRow.tsx src/components/browse/TopicCard.test.tsx src/styles/index.css
git commit -m "refactor: restructure TopicCard/TopicListRow to stretched-link pattern, wire in status/favorite controls"
```

---

### Task 5: `TopicReader` integration + `Reader.tsx` `recordView`

**Files:**
- Modify: `kb-app/src/components/reader/TopicReader.tsx`
- Modify: `kb-app/src/components/reader/TopicReader.test.tsx`
- Modify: `kb-app/src/pages/Reader.tsx`
- Modify: `kb-app/src/pages/Reader.test.tsx`

**Interfaces:**
- Consumes: `TopicStatusButton`, `TopicFavoriteButton` (Task 3); `useUserDataStore` (Task 2).
- Produces: no new exports — `TopicReader`'s props are unchanged; `Reader.tsx` gains a side effect only.

- [ ] **Step 1: Add the controls to `TopicReader.tsx`**

Modify `src/components/reader/TopicReader.tsx` — add the import and replace the category-chip line with a header row containing the chip and the two controls:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Topic } from '../../types';
import RelatedTopics from './RelatedTopics';
import TopicStatusButton from '../topic/TopicStatusButton';
import TopicFavoriteButton from '../topic/TopicFavoriteButton';

interface TopicReaderProps {
  topic: Topic;
  topicsById: Map<string, Topic>;
}

type ContentState =
  | { path: string; status: 'loaded'; html: string }
  | { path: string; status: 'error' };

export default function TopicReader({ topic, topicsById }: TopicReaderProps) {
  const [content, setContent] = useState<ContentState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(topic.contentPath)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load content: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setContent({ path: topic.contentPath, status: 'loaded', html: text });
      })
      .catch(() => {
        if (!cancelled) setContent({ path: topic.contentPath, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [topic.contentPath]);

  const isCurrent = content?.path === topic.contentPath;
  const html = isCurrent && content.status === 'loaded' ? content.html : null;
  const error = isCurrent && content.status === 'error';

  return (
    <article className="mx-auto max-w-3xl p-4">
      <nav aria-label="breadcrumb" className="mb-2 flex items-center gap-2 text-sm text-[var(--kb-muted)]">
        <Link to="/" className="hover:underline">
          מסד ידע
        </Link>
        <span aria-hidden="true">›</span>
        <span>{topic.module_label}</span>
      </nav>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="kb-category-chip w-fit" data-category={topic.category}>
          {topic.category_label}
        </span>
        <div className="flex items-center gap-2">
          <TopicStatusButton topicId={topic.id} size="lg" />
          <TopicFavoriteButton topicId={topic.id} size="lg" />
        </div>
      </div>
      <h1 className="mb-2 text-2xl font-extrabold text-[var(--kb-text)]">{topic.title}</h1>
      <p className="mb-6 text-[var(--kb-text2)]">{topic.definition}</p>
      {html === null ? (
        error ? (
          <p role="alert">שגיאה בטעינת התוכן.</p>
        ) : (
          <p role="status">טוען תוכן…</p>
        )
      ) : (
        <div className="kb-topic-content" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <RelatedTopics relatedIds={topic.related_match} topicsById={topicsById} />
    </article>
  );
}
```

- [ ] **Step 2: Extend `TopicReader.test.tsx`**

Add a `beforeEach` reset and one new test. In `src/components/reader/TopicReader.test.tsx`, add the import and reset, then a new test in the `describe('TopicReader', ...)` block:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopicReader from './TopicReader';
import { useUserDataStore } from '../../store/userDataStore';
import type { Topic } from '../../types';

const topic: Topic = {
  id: 'Intro to Data Science::algorithms::02_Linear_Regression.docx',
  module: 'Intro to Data Science',
  module_label: 'מבוא למדעי הנתונים',
  category: 'algorithms',
  category_label: 'אלגוריתמים',
  num: 2,
  slug_name: 'Linear Regression',
  title: 'Linear Regression — רגרסיה לינארית',
  definition: 'שיטת למידה מונחית לחיזוי ערך רציף.',
  related_raw: [],
  related_match: ['related-id'],
  contentPath: '/topic-content/x.html',
};

const relatedTopic: Topic = { ...topic, id: 'related-id', title: 'Related Topic' };
const topicsById = new Map([[relatedTopic.id, relatedTopic]]);

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve('<p>תוכן הנושא המלא</p>'),
  }) as unknown as typeof fetch;
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <TopicReader topic={topic} topicsById={topicsById} />
    </MemoryRouter>,
  );
}

describe('TopicReader', () => {
  it('renders the breadcrumb, category badge, title and definition', () => {
    renderWithRouter();
    expect(screen.getByText('מבוא למדעי הנתונים')).toBeInTheDocument();
    expect(screen.getByText('אלגוריתמים')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: topic.title })).toBeInTheDocument();
    expect(screen.getByText(topic.definition)).toBeInTheDocument();
  });

  it('fetches and renders the full content from contentPath', async () => {
    renderWithRouter();
    expect(fetch).toHaveBeenCalledWith('/topic-content/x.html');
    await waitFor(() => expect(screen.getByText('תוכן הנושא המלא')).toBeInTheDocument());
  });

  it('renders resolved related topics', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('Related Topic')).toBeInTheDocument());
  });

  it('renders an error state when the content fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;
    renderWithRouter();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('שגיאה בטעינת התוכן'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders an error state when the content fetch rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    renderWithRouter();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('שגיאה בטעינת התוכן'));
  });

  it('renders status and favorite controls for the topic', () => {
    renderWithRouter();
    expect(screen.getByRole('button', { name: /מצב למידה/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /מועדפים/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it passes**

Run: `npm run test -- TopicReader`
Expected: PASS.

- [ ] **Step 4: Wire `recordView` into `Reader.tsx`**

Replace `src/pages/Reader.tsx` entirely:

```tsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import type { Topic } from '../types';
import Header from '../components/layout/Header';
import TopicReader from '../components/reader/TopicReader';
import { useUserDataStore } from '../store/userDataStore';

const topics = topicsRaw as Topic[];
const topicsById = new Map(topics.map((topic) => [topic.id, topic]));

export default function Reader() {
  const { id } = useParams<{ id: string }>();
  const topic = id ? topicsById.get(id) : undefined;

  useEffect(() => {
    if (topic) {
      useUserDataStore.getState().recordView(topic.id);
    }
  }, [topic]);

  return (
    <>
      <Header />
      <main className="p-4">
        {topic ? <TopicReader topic={topic} topicsById={topicsById} /> : <p role="alert">הנושא לא נמצא.</p>}
      </main>
    </>
  );
}
```

- [ ] **Step 5: Extend `Reader.test.tsx`**

Replace `src/pages/Reader.test.tsx` entirely:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Reader from './Reader';
import topicsData from '../data/topics.clean.json';
import { useUserDataStore } from '../store/userDataStore';

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('<p>content</p>') }) as unknown as typeof fetch;
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/topic/:id" element={<Reader />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Reader', () => {
  it('renders the topic matching the encoded id in the route', () => {
    const knownTopic = topicsData[0];
    renderAt(`/topic/${encodeURIComponent(knownTopic.id)}`);
    expect(screen.getByRole('heading', { name: knownTopic.title })).toBeInTheDocument();
  });

  it('shows a not-found message for an unknown id', () => {
    renderAt(`/topic/${encodeURIComponent('does-not-exist')}`);
    expect(screen.getByRole('alert')).toHaveTextContent('הנושא לא נמצא');
  });

  it('always renders the Header', () => {
    const knownTopic = topicsData[0];
    renderAt(`/topic/${encodeURIComponent(knownTopic.id)}`);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('records a view for a known topic on mount', () => {
    const knownTopic = topicsData[0];
    renderAt(`/topic/${encodeURIComponent(knownTopic.id)}`);
    expect(useUserDataStore.getState().recents.map((r) => r.topicId)).toContain(knownTopic.id);
  });

  it('does not record a view for an unknown id', () => {
    renderAt(`/topic/${encodeURIComponent('does-not-exist')}`);
    expect(useUserDataStore.getState().recents).toEqual([]);
  });
});
```

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/reader/TopicReader.tsx src/components/reader/TopicReader.test.tsx src/pages/Reader.tsx src/pages/Reader.test.tsx
git commit -m "feat: status/favorite controls in TopicReader, recordView on open"
```

---

### Task 6: Sidebar favorites/recents sections + per-module progress bars

**Files:**
- Modify: `kb-app/src/components/layout/Sidebar.tsx`
- Modify: `kb-app/src/components/layout/Sidebar.test.tsx`
- Modify: `kb-app/src/pages/Home.tsx`

**Interfaces:**
- Consumes: `useUserDataStore` (Task 2); `Topic` from `../../types`.
- Produces: `Sidebar` gains two new required props, `moduleMasteredCounts: Record<string, number>` and `topicsById: Map<string, Topic>`; reads `favorites`/`recents` directly from `useUserDataStore`.

- [ ] **Step 1: Update `Sidebar.tsx`**

Replace `src/components/layout/Sidebar.tsx` entirely:

```tsx
import { Link } from 'react-router-dom';
import type { ModulesMap, Topic } from '../../types';
import { useUiStore } from '../../store/uiStore';
import { useUserDataStore } from '../../store/userDataStore';

interface SidebarProps {
  modules: ModulesMap;
  moduleCounts: Record<string, number>;
  moduleMasteredCounts: Record<string, number>;
  categoryLabels: Record<string, string>;
  categoryCounts: Record<string, number>;
  topicsById: Map<string, Topic>;
}

export default function Sidebar({
  modules,
  moduleCounts,
  moduleMasteredCounts,
  categoryLabels,
  categoryCounts,
  topicsById,
}: SidebarProps) {
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleModule = useUiStore((s) => s.toggleModule);
  const toggleCategory = useUiStore((s) => s.toggleCategory);
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);
  const favorites = useUserDataStore((s) => s.favorites);
  const recents = useUserDataStore((s) => s.recents);

  const favoriteTopics = [...favorites]
    .map((id) => topicsById.get(id))
    .filter((topic): topic is Topic => topic !== undefined);
  const recentTopics = recents
    .map((entry) => topicsById.get(entry.topicId))
    .filter((topic): topic is Topic => topic !== undefined);

  return (
    <>
      <button
        type="button"
        aria-label="פתח/סגור תפריט"
        aria-expanded={!sidebarCollapsed}
        onClick={toggleSidebarCollapsed}
        className="min-h-11 min-w-11 rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface)] md:hidden"
      >
        <span aria-hidden="true">☰</span>
      </button>
      <aside
        className={`shrink-0 border-e border-[var(--kb-border)] bg-[var(--kb-surface)] p-4 ${
          sidebarCollapsed ? 'hidden md:block md:w-16' : 'block w-full md:w-64'
        }`}
      >
        {favoriteTopics.length > 0 && (
          <nav aria-label="מועדפים" className="mb-6">
            <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">מועדפים</h2>
            <ul className="flex flex-col gap-1">
              {favoriteTopics.map((topic) => (
                <li key={topic.id}>
                  <Link
                    to={`/topic/${encodeURIComponent(topic.id)}`}
                    className="flex min-h-11 items-center rounded-md px-2 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
                  >
                    {topic.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {recentTopics.length > 0 && (
          <nav aria-label="נצפו לאחרונה" className="mb-6">
            <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">נצפו לאחרונה</h2>
            <ul className="flex flex-col gap-1">
              {recentTopics.map((topic) => (
                <li key={topic.id}>
                  <Link
                    to={`/topic/${encodeURIComponent(topic.id)}`}
                    className="flex min-h-11 items-center rounded-md px-2 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
                  >
                    {topic.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <nav aria-label="ניווט מודולים">
          <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">מודולים</h2>
          <ul className="flex flex-col gap-1">
            {Object.entries(modules).map(([key, label]) => {
              const total = moduleCounts[key] ?? 0;
              const mastered = moduleMasteredCounts[key] ?? 0;
              const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-pressed={selectedModules.has(key)}
                    onClick={() => toggleModule(key)}
                    className="flex min-h-11 w-full flex-col justify-center gap-1 rounded-md px-2 py-1 text-start text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] aria-pressed:bg-[var(--kb-accent-soft)]"
                  >
                    <span className="flex w-full items-center justify-between">
                      <span>{label}</span>
                      <span className="text-[var(--kb-muted)]">{total}</span>
                    </span>
                    <span className="h-1 w-full overflow-hidden rounded-full bg-[var(--kb-border)]" aria-hidden="true">
                      <span className="block h-full rounded-full bg-[var(--kb-accent)]" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="sr-only">{`${mastered} מתוך ${total} נשלטו`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <nav aria-label="ניווט קטגוריות" className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">קטגוריות</h2>
          <ul className="flex flex-col gap-1">
            {Object.entries(categoryLabels).map(([key, label]) => (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={selectedCategories.has(key)}
                  onClick={() => toggleCategory(key)}
                  className="flex min-h-11 w-full items-center justify-between rounded-md px-2 text-start text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] aria-pressed:bg-[var(--kb-accent-soft)]"
                >
                  <span>{label}</span>
                  <span className="text-[var(--kb-muted)]">{categoryCounts[key] ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Update `Sidebar.test.tsx`**

Replace `src/components/layout/Sidebar.test.tsx` entirely:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';
import { useUiStore } from '../../store/uiStore';
import { useUserDataStore } from '../../store/userDataStore';
import type { Topic } from '../../types';

const modules = { 'Intro to Data Science': 'מבוא למדעי הנתונים', 'Topic 3 - Deep Learning': 'Deep Learning' };
const moduleCounts = { 'Intro to Data Science': 8, 'Topic 3 - Deep Learning': 43 };
const moduleMasteredCounts = { 'Intro to Data Science': 2, 'Topic 3 - Deep Learning': 0 };
const categoryLabels = { algorithms: 'אלגוריתמים', concepts: 'מושגים' };
const categoryCounts = { algorithms: 45, concepts: 69 };

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
    definition: 'def',
    related_raw: [],
    related_match: [],
    contentPath: '/topic-content/x.html',
    ...overrides,
  };
}

const favTopic = topic({ id: 'fav-1', title: 'Favorite Topic' });
const recentTopic = topic({ id: 'recent-1', title: 'Recent Topic' });
const topicsById = new Map([
  [favTopic.id, favTopic],
  [recentTopic.id, recentTopic],
]);

function reset() {
  useUiStore.setState({ selectedModules: new Set(), selectedCategories: new Set(), sidebarCollapsed: false });
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
}

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar
        modules={modules}
        moduleCounts={moduleCounts}
        moduleMasteredCounts={moduleMasteredCounts}
        categoryLabels={categoryLabels}
        categoryCounts={categoryCounts}
        topicsById={topicsById}
      />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  beforeEach(reset);

  it('lists every module with its label and count', () => {
    renderSidebar();
    expect(screen.getByText('מבוא למדעי הנתונים')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('lists every category with its label and count', () => {
    renderSidebar();
    expect(screen.getByText('אלגוריתמים')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('toggles a module filter in the store when clicked', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole('button', { name: /מבוא למדעי הנתונים/ }));
    expect(useUiStore.getState().selectedModules.has('Intro to Data Science')).toBe(true);
  });

  it('reflects an active module filter via aria-pressed', async () => {
    const user = userEvent.setup();
    renderSidebar();
    const button = screen.getByRole('button', { name: /מבוא למדעי הנתונים/ });
    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('has a mobile-drawer toggle button with aria-expanded', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: 'פתח/סגור תפריט' })).toHaveAttribute('aria-expanded');
  });

  it('shows a per-module progress summary for screen readers', () => {
    renderSidebar();
    expect(screen.getByText('2 מתוך 8 נשלטו')).toBeInTheDocument();
  });

  it('does not render the favorites/recents sections when both are empty', () => {
    renderSidebar();
    expect(screen.queryByRole('navigation', { name: 'מועדפים' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'נצפו לאחרונה' })).not.toBeInTheDocument();
  });

  it('renders the favorites section with resolved topic links', () => {
    useUserDataStore.setState({ favorites: new Set(['fav-1']) });
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Favorite Topic' })).toHaveAttribute('href', '/topic/fav-1');
  });

  it('silently skips a favorite id that no longer resolves to a topic', () => {
    useUserDataStore.setState({ favorites: new Set(['fav-1', 'orphan-id']) });
    expect(() => renderSidebar()).not.toThrow();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders the recently-viewed section with resolved topic links', () => {
    useUserDataStore.setState({ recents: [{ topicId: 'recent-1', viewedAt: 1 }] });
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Recent Topic' })).toHaveAttribute('href', '/topic/recent-1');
  });
});
```

- [ ] **Step 3: Run to verify it fails, then implement, then passes**

Run: `npm run test -- Sidebar`
Expected (before Step 1's implementation is applied — if working strictly TDD, apply Step 2 first, confirm FAIL, then apply Step 1): FAIL due to missing props/behavior. After Step 1: PASS (11 tests).

- [ ] **Step 4: Wire the new props from `Home.tsx`**

Replace `src/pages/Home.tsx` entirely:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import searchIndexRaw from '../data/search-index.json';
import type { ModulesMap, SearchEntry, Topic } from '../types';
import { filterTopics } from '../lib/filterTopics';
import { groupTopicsByModule } from '../lib/groupTopics';
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav';
import { useUiStore } from '../store/uiStore';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';
import Hero from '../components/layout/Hero';
import Sidebar from '../components/layout/Sidebar';
import ShortcutsHelp from '../components/layout/ShortcutsHelp';
import SearchBar from '../components/browse/SearchBar';
import FilterChips from '../components/browse/FilterChips';
import SortMenu from '../components/browse/SortMenu';
import ViewToggle from '../components/browse/ViewToggle';
import AccordionGroup from '../components/browse/AccordionGroup';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const searchIndex = searchIndexRaw as SearchEntry[];
const topicsById = new Map(topics.map((topic) => [topic.id, topic]));

const categoryLabels: Record<string, string> = Object.fromEntries(
  topics.map((topic) => [topic.category, topic.category_label]),
);
const moduleCounts: Record<string, number> = Object.fromEntries(
  Object.keys(modules).map((key) => [key, topics.filter((topic) => topic.module === key).length]),
);
const categoryCounts: Record<string, number> = Object.fromEntries(
  Object.keys(categoryLabels).map((key) => [key, topics.filter((topic) => topic.category === key).length]),
);

export default function Home() {
  const navigate = useNavigate();
  const searchQuery = useUiStore((s) => s.searchQuery);
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const sortOrder = useUiStore((s) => s.sortOrder);
  const viewMode = useUiStore((s) => s.viewMode);
  const expandedGroups = useUiStore((s) => s.expandedGroups);
  const toggleGroup = useUiStore((s) => s.toggleGroup);
  const expandAllGroups = useUiStore((s) => s.expandAllGroups);
  const collapseAllGroups = useUiStore((s) => s.collapseAllGroups);
  const progress = useUserDataStore((s) => s.progress);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const moduleMasteredCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of Object.keys(modules)) {
      counts[key] = topics.filter((t) => t.module === key && progress.get(t.id) === 'mastered').length;
    }
    return counts;
  }, [progress]);

  const filtered = useMemo(
    () => filterTopics(topics, searchIndex, { searchQuery, selectedModules, selectedCategories, sortOrder }),
    [searchQuery, selectedModules, selectedCategories, sortOrder],
  );

  const groups = useMemo(() => groupTopicsByModule(filtered, modules), [filtered]);

  const visibleItemIds = useMemo(
    () => groups.filter((group) => expandedGroups.has(group.moduleKey)).flatMap((group) => group.topics.map((t) => t.id)),
    [groups, expandedGroups],
  );

  const { getItemProps } = useGridKeyboardNav(visibleItemIds, (id) => navigate(`/topic/${encodeURIComponent(id)}`));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isTyping = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === '?' && !isTyping) {
        setShortcutsOpen(true);
      }
      if (event.key === 'Escape') {
        setShortcutsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <Header />
      <Hero topicCount={topics.length} moduleCount={Object.keys(modules).length} />
      <div className="flex flex-col md:flex-row">
        <Sidebar
          modules={modules}
          moduleCounts={moduleCounts}
          moduleMasteredCounts={moduleMasteredCounts}
          categoryLabels={categoryLabels}
          categoryCounts={categoryCounts}
          topicsById={topicsById}
        />
        <main className="flex-1 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar />
            <SortMenu />
            <ViewToggle />
          </div>
          <FilterChips modules={modules} categoryLabels={categoryLabels} />
          <div className="mb-4 flex gap-2 text-sm">
            <button type="button" onClick={expandAllGroups} className="min-h-11 text-[var(--kb-accent)] underline">
              הרחב הכול
            </button>
            <button type="button" onClick={collapseAllGroups} className="min-h-11 text-[var(--kb-accent)] underline">
              כווץ הכול
            </button>
          </div>
          {groups.length === 0 && <p className="text-[var(--kb-muted)]">לא נמצאו נושאים.</p>}
          {groups.map((group) => (
            <AccordionGroup
              key={group.moduleKey}
              group={group}
              expanded={expandedGroups.has(group.moduleKey)}
              onToggle={() => toggleGroup(group.moduleKey)}
              viewMode={viewMode}
              highlightTerm={searchQuery}
              getItemProps={getItemProps}
            />
          ))}
        </main>
      </div>
      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
```

(This step's `filterTopics`/`Hero` calls are still the Phase-2 signatures — Tasks 7 and 8 update them next. Passing `moduleMasteredCounts`/`topicsById` to `Sidebar` here is the only change in this task.)

- [ ] **Step 5: Update `Home.test.tsx`'s reset helper**

In `src/pages/Home.test.tsx`, add the `userDataStore` import and reset call:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { useUiStore } from '../store/uiStore';
import { useUserDataStore } from '../store/userDataStore';
import topicsData from '../data/topics.clean.json';

function reset() {
  const allModuleKeys = [...new Set(topicsData.map((t) => t.module))];
  useUiStore.setState({
    searchQuery: '',
    selectedModules: new Set(),
    selectedCategories: new Set(),
    sortOrder: 'original',
    viewMode: 'grid',
    sidebarCollapsed: false,
    expandedGroups: new Set(allModuleKeys),
  });
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
}
```

(Leave the rest of `Home.test.tsx` — the `describe('Home', ...)` block and its tests — unchanged for this task; Task 8 adds status-filter-specific tests.)

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/Sidebar.test.tsx src/pages/Home.tsx src/pages/Home.test.tsx
git commit -m "feat: Sidebar favorites/recents sections + per-module progress bars"
```

---

### Task 7: Hero overall progress stat card

**Files:**
- Modify: `kb-app/src/components/layout/Hero.tsx`
- Modify: `kb-app/src/components/layout/Hero.test.tsx`
- Modify: `kb-app/src/pages/Home.tsx`

**Interfaces:**
- Produces: `Hero` gains a new required prop `masteredCount: number`.

- [ ] **Step 1: Write the failing tests**

Replace `src/components/layout/Hero.test.tsx` entirely:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Hero from './Hero';

describe('Hero', () => {
  it('renders the topic and module counts', () => {
    render(<Hero topicCount={160} moduleCount={5} masteredCount={0} />);
    expect(screen.getByText('160')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders a heading', () => {
    render(<Hero topicCount={160} moduleCount={5} masteredCount={0} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders the mastered-topics stat, including the zero-mastered default', () => {
    render(<Hero topicCount={160} moduleCount={5} masteredCount={0} />);
    expect(screen.getByText('מתוך 160 נשלטו')).toBeInTheDocument();
  });

  it('reflects a non-zero mastered count', () => {
    render(<Hero topicCount={160} moduleCount={5} masteredCount={12} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- Hero.test`
Expected: FAIL — `masteredCount` prop unused/type error, or missing text.

- [ ] **Step 3: Implement `Hero.tsx`**

Replace `src/components/layout/Hero.tsx` entirely:

```tsx
interface HeroProps {
  topicCount: number;
  moduleCount: number;
  masteredCount: number;
}

export default function Hero({ topicCount, moduleCount, masteredCount }: HeroProps) {
  return (
    <section className="px-4 py-8 text-center">
      <h1 className="text-2xl font-extrabold text-[var(--kb-text)] sm:text-3xl">מסד ידע — AI Engineer</h1>
      <p className="mx-auto mt-2 max-w-prose text-[var(--kb-text2)]">
        אוסף נושאים מרוכז ללימוד הנדסת AI — אלגוריתמים, מושגים, ארכיטקטורות ועוד.
      </p>
      <div className="mx-auto mt-6 flex w-fit flex-wrap justify-center gap-4">
        <div className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] px-6 py-3 shadow-[var(--kb-shadow-sm)]">
          <div className="text-2xl font-bold text-[var(--kb-accent)]">{topicCount}</div>
          <div className="text-sm text-[var(--kb-muted)]">נושאים</div>
        </div>
        <div className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] px-6 py-3 shadow-[var(--kb-shadow-sm)]">
          <div className="text-2xl font-bold text-[var(--kb-accent)]">{moduleCount}</div>
          <div className="text-sm text-[var(--kb-muted)]">מודולים</div>
        </div>
        <div className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] px-6 py-3 shadow-[var(--kb-shadow-sm)]">
          <div className="text-2xl font-bold text-[var(--kb-accent)]">{masteredCount}</div>
          <div className="text-sm text-[var(--kb-muted)]">{`מתוך ${topicCount} נשלטו`}</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- Hero.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire `masteredCount` from `Home.tsx`**

In `src/pages/Home.tsx`, add a `masteredCount` computation next to `moduleMasteredCounts` (inside the `Home` component):

```tsx
  const masteredCount = useMemo(
    () => topics.filter((t) => progress.get(t.id) === 'mastered').length,
    [progress],
  );
```

and update the `<Hero>` call:

```tsx
      <Hero topicCount={topics.length} moduleCount={Object.keys(modules).length} masteredCount={masteredCount} />
```

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Hero.tsx src/components/layout/Hero.test.tsx src/pages/Home.tsx
git commit -m "feat: Hero overall mastered-topics stat card"
```

---

### Task 8: Filter integration — status filter across types/uiStore/filterTopics/FilterChips/Home

**Files:**
- Modify: `kb-app/src/types.ts`
- Modify: `kb-app/src/store/uiStore.ts`
- Modify: `kb-app/src/store/uiStore.test.ts`
- Modify: `kb-app/src/lib/filterTopics.ts`
- Modify: `kb-app/src/lib/filterTopics.test.ts`
- Modify: `kb-app/src/components/browse/FilterChips.tsx`
- Modify: `kb-app/src/components/browse/FilterChips.test.tsx`
- Modify: `kb-app/src/pages/Home.tsx`
- Modify: `kb-app/src/pages/Home.test.tsx`

**Interfaces:**
- Produces: `FilterState.selectedStatuses: Set<ProgressStatus>`; `uiStore` gains `selectedStatuses` state + `toggleStatus(status)` action (included in `clearFilters`); `filterTopics` gains a required 4th parameter `progress: Map<string, ProgressStatus>`.

- [ ] **Step 1: Add `selectedStatuses` to `FilterState`**

In `src/types.ts`, modify the `FilterState` interface:

```ts
export interface FilterState {
  searchQuery: string;
  selectedModules: Set<string>;
  selectedCategories: Set<string>;
  selectedStatuses: Set<ProgressStatus>;
  sortOrder: SortOrder;
}
```

- [ ] **Step 2: Write the failing `uiStore` tests**

In `src/store/uiStore.test.ts`, update the `reset()` helper and add new tests:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import modulesData from '../data/modules.json';
import { useUiStore } from './uiStore';

const allModuleKeys = Object.keys(modulesData as Record<string, string>);

function reset() {
  useUiStore.setState({
    searchQuery: '',
    selectedModules: new Set(),
    selectedCategories: new Set(),
    selectedStatuses: new Set(),
    sortOrder: 'original',
    viewMode: 'grid',
    sidebarCollapsed: false,
    expandedGroups: new Set(allModuleKeys),
  });
}

describe('uiStore', () => {
  beforeEach(reset);

  it('starts with all groups expanded and no filters', () => {
    const state = useUiStore.getState();
    expect(state.expandedGroups.size).toBe(allModuleKeys.length);
    expect(state.selectedModules.size).toBe(0);
    expect(state.selectedCategories.size).toBe(0);
    expect(state.selectedStatuses.size).toBe(0);
    expect(state.searchQuery).toBe('');
  });

  it('setSearchQuery updates the query', () => {
    useUiStore.getState().setSearchQuery('regression');
    expect(useUiStore.getState().searchQuery).toBe('regression');
  });

  it('toggleModule adds then removes a module (OR-within-type set)', () => {
    const { toggleModule } = useUiStore.getState();
    toggleModule('Intro to Data Science');
    expect(useUiStore.getState().selectedModules.has('Intro to Data Science')).toBe(true);
    toggleModule('Intro to Data Science');
    expect(useUiStore.getState().selectedModules.has('Intro to Data Science')).toBe(false);
  });

  it('toggleCategory adds then removes a category', () => {
    const { toggleCategory } = useUiStore.getState();
    toggleCategory('algorithms');
    expect(useUiStore.getState().selectedCategories.has('algorithms')).toBe(true);
    toggleCategory('algorithms');
    expect(useUiStore.getState().selectedCategories.has('algorithms')).toBe(false);
  });

  it('toggleStatus adds then removes a status', () => {
    const { toggleStatus } = useUiStore.getState();
    toggleStatus('mastered');
    expect(useUiStore.getState().selectedStatuses.has('mastered')).toBe(true);
    toggleStatus('mastered');
    expect(useUiStore.getState().selectedStatuses.has('mastered')).toBe(false);
  });

  it('clearFilters resets query, modules, categories and statuses but not sort/view', () => {
    const store = useUiStore.getState();
    store.setSearchQuery('x');
    store.toggleModule('Intro to Data Science');
    store.toggleCategory('algorithms');
    store.toggleStatus('mastered');
    store.setSortOrder('alpha');
    store.clearFilters();

    const state = useUiStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.selectedModules.size).toBe(0);
    expect(state.selectedCategories.size).toBe(0);
    expect(state.selectedStatuses.size).toBe(0);
    expect(state.sortOrder).toBe('alpha'); // untouched
  });

  it('setSortOrder and setViewMode update their fields', () => {
    useUiStore.getState().setSortOrder('category');
    useUiStore.getState().setViewMode('list');
    expect(useUiStore.getState().sortOrder).toBe('category');
    expect(useUiStore.getState().viewMode).toBe('list');
  });

  it('toggleSidebarCollapsed flips the flag', () => {
    useUiStore.getState().toggleSidebarCollapsed();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    useUiStore.getState().toggleSidebarCollapsed();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it('toggleGroup, expandAllGroups, collapseAllGroups manage expandedGroups', () => {
    const store = useUiStore.getState();
    const someModule = allModuleKeys[0];

    store.toggleGroup(someModule);
    expect(useUiStore.getState().expandedGroups.has(someModule)).toBe(false);

    store.collapseAllGroups();
    expect(useUiStore.getState().expandedGroups.size).toBe(0);

    store.expandAllGroups();
    expect(useUiStore.getState().expandedGroups.size).toBe(allModuleKeys.length);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -- uiStore`
Expected: FAIL — `toggleStatus` not a function.

- [ ] **Step 4: Implement the `uiStore` changes**

Replace `src/store/uiStore.ts` entirely:

```ts
import { create } from 'zustand';
import modulesData from '../data/modules.json';
import type { ProgressStatus, SortOrder, ViewMode } from '../types';

const allModuleKeys = Object.keys(modulesData as Record<string, string>);

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

interface UiState {
  searchQuery: string;
  selectedModules: Set<string>;
  selectedCategories: Set<string>;
  selectedStatuses: Set<ProgressStatus>;
  sortOrder: SortOrder;
  viewMode: ViewMode;
  sidebarCollapsed: boolean;
  expandedGroups: Set<string>;

  setSearchQuery: (query: string) => void;
  toggleModule: (moduleKey: string) => void;
  toggleCategory: (category: string) => void;
  toggleStatus: (status: ProgressStatus) => void;
  clearFilters: () => void;
  setSortOrder: (order: SortOrder) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebarCollapsed: () => void;
  toggleGroup: (moduleKey: string) => void;
  expandAllGroups: () => void;
  collapseAllGroups: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  searchQuery: '',
  selectedModules: new Set(),
  selectedCategories: new Set(),
  selectedStatuses: new Set(),
  sortOrder: 'original',
  viewMode: 'grid',
  sidebarCollapsed: false,
  expandedGroups: new Set(allModuleKeys),

  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleModule: (moduleKey) =>
    set((state) => ({ selectedModules: toggleInSet(state.selectedModules, moduleKey) })),
  toggleCategory: (category) =>
    set((state) => ({ selectedCategories: toggleInSet(state.selectedCategories, category) })),
  toggleStatus: (status) =>
    set((state) => ({ selectedStatuses: toggleInSet(state.selectedStatuses, status) })),
  clearFilters: () =>
    set({
      searchQuery: '',
      selectedModules: new Set(),
      selectedCategories: new Set(),
      selectedStatuses: new Set(),
    }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleGroup: (moduleKey) =>
    set((state) => ({ expandedGroups: toggleInSet(state.expandedGroups, moduleKey) })),
  expandAllGroups: () => set({ expandedGroups: new Set(allModuleKeys) }),
  collapseAllGroups: () => set({ expandedGroups: new Set() }),
}));
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- uiStore`
Expected: PASS (9 tests).

- [ ] **Step 6: Write the failing `filterTopics` tests**

Replace `src/lib/filterTopics.test.ts` entirely:

```ts
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
  topic({ id: 'a', title: 'Linear Regression', category: 'algorithms', module: 'Intro to Data Science' }),
  topic({ id: 'b', title: 'K-Means Clustering', category: 'algorithms', module: 'Topic 1 - Unsupervised Learning' }),
  topic({ id: 'c', title: 'Bias-Variance Tradeoff', category: 'concepts', module: 'Intro to Data Science' }),
  topic({ id: 'd', title: 'Attention Mechanism', category: 'concepts', module: 'Topic 3 - Deep Learning' }),
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
    expect(result.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
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
```

- [ ] **Step 7: Run to verify it fails**

Run: `npm run test -- filterTopics`
Expected: FAIL — wrong number of arguments / missing `selectedStatuses`.

- [ ] **Step 8: Implement the `filterTopics` change**

Replace `src/lib/filterTopics.ts` entirely:

```ts
import { normalize } from './normalize';
import type { FilterState, ProgressStatus, SearchEntry, Topic } from '../types';

export function filterTopics(
  topics: Topic[],
  searchIndex: SearchEntry[],
  filters: FilterState,
  progress: Map<string, ProgressStatus>,
): Topic[] {
  const normalizedQuery = normalize(filters.searchQuery);
  const matchedIds = normalizedQuery
    ? new Set(
        searchIndex.filter((entry) => entry.search.includes(normalizedQuery)).map((entry) => entry.id),
      )
    : null;

  const result = topics.filter((topic) => {
    if (matchedIds && !matchedIds.has(topic.id)) return false;
    if (filters.selectedModules.size > 0 && !filters.selectedModules.has(topic.module)) return false;
    if (filters.selectedCategories.size > 0 && !filters.selectedCategories.has(topic.category)) {
      return false;
    }
    if (filters.selectedStatuses.size > 0) {
      const status = progress.get(topic.id) ?? 'new';
      if (!filters.selectedStatuses.has(status)) return false;
    }
    return true;
  });

  return sortTopics(result, filters.sortOrder);
}

function sortTopics(topics: Topic[], sortOrder: FilterState['sortOrder']): Topic[] {
  if (sortOrder === 'original') return topics;

  const sorted = [...topics];
  if (sortOrder === 'alpha') {
    sorted.sort((a, b) => a.title.localeCompare(b.title, 'he'));
  } else {
    sorted.sort((a, b) => {
      const byCategory = a.category_label.localeCompare(b.category_label, 'he');
      return byCategory !== 0 ? byCategory : a.title.localeCompare(b.title, 'he');
    });
  }
  return sorted;
}
```

- [ ] **Step 9: Run to verify it passes**

Run: `npm run test -- filterTopics`
Expected: PASS (13 tests).

- [ ] **Step 10: Write the failing `FilterChips` tests**

Replace `src/components/browse/FilterChips.test.tsx` entirely:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterChips from './FilterChips';
import { useUiStore } from '../../store/uiStore';

const modules = { 'Intro to Data Science': 'מבוא למדעי הנתונים' };
const categoryLabels = { algorithms: 'אלגוריתמים' };

function reset() {
  useUiStore.setState({ selectedModules: new Set(), selectedCategories: new Set(), selectedStatuses: new Set() });
}

describe('FilterChips', () => {
  beforeEach(reset);

  it('renders nothing when no filters are active', () => {
    const { container } = render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a chip per active module and category filter', () => {
    useUiStore.setState({
      selectedModules: new Set(['Intro to Data Science']),
      selectedCategories: new Set(['algorithms']),
    });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    expect(screen.getByText(/מבוא למדעי הנתונים/)).toBeInTheDocument();
    expect(screen.getByText(/אלגוריתמים/)).toBeInTheDocument();
  });

  it('renders a chip for an active status filter, with its Hebrew label', () => {
    useUiStore.setState({ selectedStatuses: new Set(['mastered']) });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    expect(screen.getByText(/נשלט/)).toBeInTheDocument();
  });

  it('removes a status chip on click without affecting module/category filters', async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      selectedModules: new Set(['Intro to Data Science']),
      selectedStatuses: new Set(['mastered']),
    });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    await user.click(screen.getByText(/נשלט/));
    expect(useUiStore.getState().selectedStatuses.size).toBe(0);
    expect(useUiStore.getState().selectedModules.size).toBe(1);
  });

  it('removes a single chip on click without affecting others', async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      selectedModules: new Set(['Intro to Data Science']),
      selectedCategories: new Set(['algorithms']),
    });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    await user.click(screen.getByText(/מבוא למדעי הנתונים/));
    expect(useUiStore.getState().selectedModules.size).toBe(0);
    expect(useUiStore.getState().selectedCategories.size).toBe(1);
  });

  it('"clear all" removes every filter including statuses', async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      selectedModules: new Set(['Intro to Data Science']),
      selectedCategories: new Set(['algorithms']),
      selectedStatuses: new Set(['mastered']),
    });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    await user.click(screen.getByRole('button', { name: 'נקה הכול' }));
    expect(useUiStore.getState().selectedModules.size).toBe(0);
    expect(useUiStore.getState().selectedCategories.size).toBe(0);
    expect(useUiStore.getState().selectedStatuses.size).toBe(0);
  });
});
```

- [ ] **Step 11: Run to verify it fails**

Run: `npm run test -- FilterChips`
Expected: FAIL — no status chip rendered.

- [ ] **Step 12: Implement the `FilterChips` change**

Replace `src/components/browse/FilterChips.tsx` entirely:

```tsx
import type { ModulesMap, ProgressStatus } from '../../types';
import { useUiStore } from '../../store/uiStore';
import { STATUS_LABELS } from '../../lib/progressStatus';

interface FilterChipsProps {
  modules: ModulesMap;
  categoryLabels: Record<string, string>;
}

type Chip =
  | { kind: 'module'; key: string; label: string }
  | { kind: 'category'; key: string; label: string }
  | { kind: 'status'; key: ProgressStatus; label: string };

export default function FilterChips({ modules, categoryLabels }: FilterChipsProps) {
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const selectedStatuses = useUiStore((s) => s.selectedStatuses);
  const toggleModule = useUiStore((s) => s.toggleModule);
  const toggleCategory = useUiStore((s) => s.toggleCategory);
  const toggleStatus = useUiStore((s) => s.toggleStatus);
  const clearFilters = useUiStore((s) => s.clearFilters);

  const chips: Chip[] = [
    ...[...selectedModules].map((key): Chip => ({ kind: 'module', key, label: modules[key] ?? key })),
    ...[...selectedCategories].map((key): Chip => ({ kind: 'category', key, label: categoryLabels[key] ?? key })),
    ...[...selectedStatuses].map((key): Chip => ({ kind: 'status', key, label: STATUS_LABELS[key] })),
  ];

  if (chips.length === 0) return null;

  function removeChip(chip: Chip) {
    if (chip.kind === 'module') toggleModule(chip.key);
    else if (chip.kind === 'category') toggleCategory(chip.key);
    else toggleStatus(chip.key);
  }

  return (
    <div role="list" aria-label="סינון פעיל" className="flex flex-wrap gap-2 py-2">
      {chips.map((chip) => (
        <button
          key={`${chip.kind}-${chip.key}`}
          type="button"
          role="listitem"
          onClick={() => removeChip(chip)}
          className="flex min-h-11 items-center gap-1 rounded-full bg-[var(--kb-accent-soft)] px-3 text-sm text-[var(--kb-text)]"
        >
          {chip.label} <span aria-hidden="true">✕</span>
        </button>
      ))}
      <button
        type="button"
        onClick={clearFilters}
        className="min-h-11 rounded-full border border-[var(--kb-border-strong)] px-3 text-sm text-[var(--kb-muted)]"
      >
        נקה הכול
      </button>
    </div>
  );
}
```

- [ ] **Step 13: Run to verify it passes**

Run: `npm run test -- FilterChips`
Expected: PASS (6 tests).

- [ ] **Step 14: Wire status filtering + toggle buttons into `Home.tsx`**

Replace `src/pages/Home.tsx` entirely:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import searchIndexRaw from '../data/search-index.json';
import type { ModulesMap, SearchEntry, Topic } from '../types';
import { filterTopics } from '../lib/filterTopics';
import { groupTopicsByModule } from '../lib/groupTopics';
import { ALL_STATUSES, STATUS_GLYPHS, STATUS_LABELS } from '../lib/progressStatus';
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav';
import { useUiStore } from '../store/uiStore';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';
import Hero from '../components/layout/Hero';
import Sidebar from '../components/layout/Sidebar';
import ShortcutsHelp from '../components/layout/ShortcutsHelp';
import SearchBar from '../components/browse/SearchBar';
import FilterChips from '../components/browse/FilterChips';
import SortMenu from '../components/browse/SortMenu';
import ViewToggle from '../components/browse/ViewToggle';
import AccordionGroup from '../components/browse/AccordionGroup';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const searchIndex = searchIndexRaw as SearchEntry[];
const topicsById = new Map(topics.map((topic) => [topic.id, topic]));

const categoryLabels: Record<string, string> = Object.fromEntries(
  topics.map((topic) => [topic.category, topic.category_label]),
);
const moduleCounts: Record<string, number> = Object.fromEntries(
  Object.keys(modules).map((key) => [key, topics.filter((topic) => topic.module === key).length]),
);
const categoryCounts: Record<string, number> = Object.fromEntries(
  Object.keys(categoryLabels).map((key) => [key, topics.filter((topic) => topic.category === key).length]),
);

export default function Home() {
  const navigate = useNavigate();
  const searchQuery = useUiStore((s) => s.searchQuery);
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const selectedStatuses = useUiStore((s) => s.selectedStatuses);
  const toggleStatus = useUiStore((s) => s.toggleStatus);
  const sortOrder = useUiStore((s) => s.sortOrder);
  const viewMode = useUiStore((s) => s.viewMode);
  const expandedGroups = useUiStore((s) => s.expandedGroups);
  const toggleGroup = useUiStore((s) => s.toggleGroup);
  const expandAllGroups = useUiStore((s) => s.expandAllGroups);
  const collapseAllGroups = useUiStore((s) => s.collapseAllGroups);
  const progress = useUserDataStore((s) => s.progress);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const moduleMasteredCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of Object.keys(modules)) {
      counts[key] = topics.filter((t) => t.module === key && progress.get(t.id) === 'mastered').length;
    }
    return counts;
  }, [progress]);

  const masteredCount = useMemo(
    () => topics.filter((t) => progress.get(t.id) === 'mastered').length,
    [progress],
  );

  const filtered = useMemo(
    () =>
      filterTopics(
        topics,
        searchIndex,
        { searchQuery, selectedModules, selectedCategories, selectedStatuses, sortOrder },
        progress,
      ),
    [searchQuery, selectedModules, selectedCategories, selectedStatuses, sortOrder, progress],
  );

  const groups = useMemo(() => groupTopicsByModule(filtered, modules), [filtered]);

  const visibleItemIds = useMemo(
    () => groups.filter((group) => expandedGroups.has(group.moduleKey)).flatMap((group) => group.topics.map((t) => t.id)),
    [groups, expandedGroups],
  );

  const { getItemProps } = useGridKeyboardNav(visibleItemIds, (id) => navigate(`/topic/${encodeURIComponent(id)}`));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isTyping = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === '?' && !isTyping) {
        setShortcutsOpen(true);
      }
      if (event.key === 'Escape') {
        setShortcutsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <Header />
      <Hero topicCount={topics.length} moduleCount={Object.keys(modules).length} masteredCount={masteredCount} />
      <div className="flex flex-col md:flex-row">
        <Sidebar
          modules={modules}
          moduleCounts={moduleCounts}
          moduleMasteredCounts={moduleMasteredCounts}
          categoryLabels={categoryLabels}
          categoryCounts={categoryCounts}
          topicsById={topicsById}
        />
        <main className="flex-1 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar />
            <div className="flex gap-1" role="group" aria-label="סינון לפי מצב למידה">
              {ALL_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={selectedStatuses.has(status)}
                  onClick={() => toggleStatus(status)}
                  className="flex min-h-11 items-center gap-1 rounded-full border border-[var(--kb-border)] px-3 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] aria-pressed:bg-[var(--kb-accent-soft)]"
                >
                  <span aria-hidden="true">{STATUS_GLYPHS[status]}</span>
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
            <SortMenu />
            <ViewToggle />
          </div>
          <FilterChips modules={modules} categoryLabels={categoryLabels} />
          <div className="mb-4 flex gap-2 text-sm">
            <button type="button" onClick={expandAllGroups} className="min-h-11 text-[var(--kb-accent)] underline">
              הרחב הכול
            </button>
            <button type="button" onClick={collapseAllGroups} className="min-h-11 text-[var(--kb-accent)] underline">
              כווץ הכול
            </button>
          </div>
          {groups.length === 0 && <p className="text-[var(--kb-muted)]">לא נמצאו נושאים.</p>}
          {groups.map((group) => (
            <AccordionGroup
              key={group.moduleKey}
              group={group}
              expanded={expandedGroups.has(group.moduleKey)}
              onToggle={() => toggleGroup(group.moduleKey)}
              viewMode={viewMode}
              highlightTerm={searchQuery}
              getItemProps={getItemProps}
            />
          ))}
        </main>
      </div>
      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
```

- [ ] **Step 15: Extend `Home.test.tsx`**

In `src/pages/Home.test.tsx`, update the `reset()` helper's `uiStore.setState` call to include `selectedStatuses: new Set()`, and add two new tests inside `describe('Home', ...)`:

```tsx
function reset() {
  const allModuleKeys = [...new Set(topicsData.map((t) => t.module))];
  useUiStore.setState({
    searchQuery: '',
    selectedModules: new Set(),
    selectedCategories: new Set(),
    selectedStatuses: new Set(),
    sortOrder: 'original',
    viewMode: 'grid',
    sidebarCollapsed: false,
    expandedGroups: new Set(allModuleKeys),
  });
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
}
```

```tsx
  it('renders the mastered-count stat reflecting progress store state', () => {
    useUserDataStore.setState({ progress: new Map([[topicsData[0].id, 'mastered']]) });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(`מתוך ${topicsData.length} נשלטו`)).toBeInTheDocument();
  });

  it('narrows visible topics when a status filter is toggled from the store', () => {
    useUserDataStore.setState({ progress: new Map([[topicsData[0].id, 'mastered']]) });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    act(() => {
      useUiStore.getState().toggleStatus('mastered');
    });
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
```

(Add these as two more `it(...)` blocks inside the existing `describe('Home', ...)`, alongside the tests already there from Phase 2 and Task 6.)

- [ ] **Step 16: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all PASS.

- [ ] **Step 17: Manual check (Definition of Done for the whole sub-project)**

Run `npm run dev` and confirm, in both light and dark theme, with RTL layout, keyboard-only, and a mobile viewport:
- Status pill cycles new → learning → mastered → new and persists across a page reload.
- Favorite star toggles and the topic appears in Sidebar's "מועדפים".
- Opening topics populates "נצפו לאחרונה" (max 12, no duplicates, most recent first).
- Per-module and overall (Hero) progress bars/stats update as statuses change.
- Status filter buttons narrow the grid and produce removable chips alongside module/category filters; "נקה הכול" clears everything.
- The whole card remains clickable outside the two buttons, in grid and list view.
- Open the app in a private/incognito window and confirm it still works (progress/favorites just don't persist) — simulating IndexedDB being unavailable.

- [ ] **Step 18: Commit**

```bash
git add src/types.ts src/store/uiStore.ts src/store/uiStore.test.ts src/lib/filterTopics.ts src/lib/filterTopics.test.ts src/components/browse/FilterChips.tsx src/components/browse/FilterChips.test.tsx src/pages/Home.tsx src/pages/Home.test.tsx
git commit -m "feat: status filter integration (types/uiStore/filterTopics/FilterChips/Home)"
```
