# Phase 3, Sub-project #3 — Flashcards + SRS + Daily Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user study any topic as a flashcard with a simplified SM-2 spaced-repetition schedule, persisted locally, plus a "today to learn" summary on the home page.

**Architecture:** A fifth `kb-user-data` IndexedDB store (`srsCards`) mirrors the pattern of `progress`/`favorites`/`recents`/`notes`; a pure `src/lib/srs.ts` holds the SM-2 algorithm (no store/IndexedDB import); `userDataStore` gets one new state slice + action; a new `Flashcards` page owns its own page-local session/filter state (deliberately not global `uiStore`); `Header` gains a persistent nav link with a due-count badge; `Home` gains a small Daily Review card.

**Tech Stack:** React 19, TypeScript, Zustand, `idb` (already a dependency), Vitest + Testing Library + `fake-indexeddb` (already configured), `react-router-dom`.

**Spec:** `docs/superpowers/specs/2026-09-07-phase3-flashcards-srs-design.md`

## Global Constraints

- `topic.id` is the sole key for all user data (golden rule 2) — `srsCards` store keyed by `topicId`, same as every other store.
- Local-first: every `db.ts` function catches its own errors, `console.warn`s at most once per session (never `console.error`), and returns a safe default (golden rule 3).
- Absence of an `SrsCard` record means "never reviewed" and counts as **immediately due** — `isDue(undefined, now)` is `true`.
- `src/lib/srs.ts` is pure: no store or IndexedDB import, matching `filterTopics.ts`/`progressStatus.ts`.
- SM-2 mapping (Anki's simplified scheme), applied on every rating (`reps += 1`, `dueAt = now + intervalDays * 86400000`, `updatedAt = now`):
  - **Again:** `intervalDays = 1`; `ease = max(1.3, ease - 0.2)`; `lapses += 1`.
  - **Hard:** `intervalDays = max(1, round(intervalDays * 1.2))`; `ease = max(1.3, ease - 0.15)`.
  - **Good:** `intervalDays = max(1, round(intervalDays * ease))`.
  - **Easy:** `intervalDays = max(1, round(intervalDays * ease * 1.3))`; `ease = ease + 0.15`.
  - A never-reviewed card starts from `{ease: 2.5, intervalDays: 0, reps: 0, lapses: 0}` before applying the rating above.
- An "Again"-rated card leaves the current session and is not reinserted (no same-session requeue).
- Grading a flashcard never touches the topic's `progress` status — the two systems are independent.
- The Flashcards page's module/category/status/due-only filters are **page-local React state**, not `uiStore` — filtering while browsing Home must never affect the study deck, and vice versa.
- RTL, both themes, keyboard operability, `focus-visible`, and `--kb-*` tokens only (golden rules 5-7) apply to every new UI element.

---

## Task 1: `SrsCard`/`SrsRating` types + `lib/srs.ts` (pure algorithm)

**Files:**
- Modify: `kb-app/src/types.ts`
- Create: `kb-app/src/lib/srs.ts`
- Test: `kb-app/src/lib/srs.test.ts`

**Interfaces:**
- Produces: `SrsCard { topicId, ease, intervalDays, dueAt, reps, lapses, updatedAt }`, `SrsRating = 'again' | 'hard' | 'good' | 'easy'` (in `src/types.ts`); `isDue(card: SrsCard | undefined, now: number): boolean`, `gradeCard(topicId: string, card: SrsCard | undefined, rating: SrsRating, now: number): SrsCard`, `getDueTopicIds(topics: Topic[], srsCards: Map<string, SrsCard>, now: number): string[]` (in `src/lib/srs.ts`).

- [ ] **Step 1: Add the types**

Append to `kb-app/src/types.ts` (after the existing `Note` interface):

```ts
export interface SrsCard {
  topicId: string;
  ease: number;
  intervalDays: number;
  dueAt: number;
  reps: number;
  lapses: number;
  updatedAt: number;
}

export type SrsRating = 'again' | 'hard' | 'good' | 'easy';
```

- [ ] **Step 2: Write the failing tests**

Create `kb-app/src/lib/srs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { gradeCard, getDueTopicIds, isDue } from './srs';
import type { SrsCard, Topic } from '../types';

const NOW = 1_700_000_000_000;
const DAY_MS = 86400000;

function card(overrides: Partial<SrsCard>): SrsCard {
  return { topicId: 'a', ease: 2.5, intervalDays: 0, dueAt: NOW, reps: 0, lapses: 0, updatedAt: NOW, ...overrides };
}

describe('isDue', () => {
  it('treats a missing record as due', () => {
    expect(isDue(undefined, NOW)).toBe(true);
  });

  it('treats a past-due dueAt as due', () => {
    expect(isDue(card({ dueAt: NOW - 1 }), NOW)).toBe(true);
  });

  it('treats dueAt exactly now as due', () => {
    expect(isDue(card({ dueAt: NOW }), NOW)).toBe(true);
  });

  it('treats a future dueAt as not due', () => {
    expect(isDue(card({ dueAt: NOW + 1 }), NOW)).toBe(false);
  });
});

describe('gradeCard', () => {
  it('starts a never-reviewed topic at ease 2.5, interval 0, then applies the rating', () => {
    const result = gradeCard('a', undefined, 'good', NOW);
    expect(result).toMatchObject({ topicId: 'a', ease: 2.5, intervalDays: 1, reps: 1, lapses: 0 });
    expect(result.dueAt).toBe(NOW + 1 * DAY_MS);
    expect(result.updatedAt).toBe(NOW);
  });

  it('again resets interval to 1 day, drops ease by 0.2, increments lapses', () => {
    const current = card({ ease: 2.5, intervalDays: 10, reps: 3, lapses: 0 });
    const result = gradeCard('a', current, 'again', NOW);
    expect(result.intervalDays).toBe(1);
    expect(result.ease).toBeCloseTo(2.3);
    expect(result.lapses).toBe(1);
    expect(result.reps).toBe(4);
    expect(result.dueAt).toBe(NOW + DAY_MS);
  });

  it('again never drops ease below the 1.3 floor', () => {
    const current = card({ ease: 1.35, intervalDays: 5 });
    const result = gradeCard('a', current, 'again', NOW);
    expect(result.ease).toBeCloseTo(1.3);
  });

  it('hard multiplies interval by 1.2 (rounded) and drops ease by 0.15', () => {
    const current = card({ ease: 2.0, intervalDays: 10 });
    const result = gradeCard('a', current, 'hard', NOW);
    expect(result.intervalDays).toBe(12);
    expect(result.ease).toBeCloseTo(1.85);
  });

  it('hard never drops ease below the 1.3 floor', () => {
    const current = card({ ease: 1.4, intervalDays: 5 });
    const result = gradeCard('a', current, 'hard', NOW);
    expect(result.ease).toBeCloseTo(1.3);
  });

  it('good multiplies interval by ease, at least 1 day, and leaves ease unchanged', () => {
    const current = card({ ease: 2.5, intervalDays: 4 });
    const result = gradeCard('a', current, 'good', NOW);
    expect(result.intervalDays).toBe(10);
    expect(result.ease).toBe(2.5);
  });

  it('easy multiplies interval by ease*1.3 and increases ease by 0.15', () => {
    const current = card({ ease: 2.5, intervalDays: 4 });
    const result = gradeCard('a', current, 'easy', NOW);
    expect(result.intervalDays).toBe(13);
    expect(result.ease).toBeCloseTo(2.65);
  });

  it('interval never drops below 1 day even from a 0-interval hard/easy rating', () => {
    expect(gradeCard('a', undefined, 'hard', NOW).intervalDays).toBe(1);
    expect(gradeCard('a', undefined, 'easy', NOW).intervalDays).toBe(1);
  });

  it('preserves the topicId argument regardless of an existing card', () => {
    expect(gradeCard('specific-id', undefined, 'good', NOW).topicId).toBe('specific-id');
  });
});

describe('getDueTopicIds', () => {
  function topic(id: string): Topic {
    return {
      id,
      module: 'm',
      module_label: 'M',
      category: 'concepts',
      category_label: 'C',
      num: 1,
      slug_name: id,
      title: id,
      definition: 'd',
      related_raw: [],
      related_match: [],
      contentPath: '/x.html',
    };
  }

  it('includes never-reviewed and past-due topics, excludes future-due topics', () => {
    const topics = [topic('a'), topic('b'), topic('c')];
    const srsCards = new Map<string, SrsCard>([
      ['b', card({ topicId: 'b', dueAt: NOW - 1 })],
      ['c', card({ topicId: 'c', dueAt: NOW + DAY_MS })],
    ]);
    expect(getDueTopicIds(topics, srsCards, NOW)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- srs.test.ts`
Expected: FAIL — `./srs` does not exist.

- [ ] **Step 4: Implement `srs.ts`**

Create `kb-app/src/lib/srs.ts`:

```ts
import type { SrsCard, SrsRating, Topic } from '../types';

const DAY_MS = 86400000;
const MIN_EASE = 1.3;
const STARTING_EASE = 2.5;

export function isDue(card: SrsCard | undefined, now: number): boolean {
  return card === undefined || card.dueAt <= now;
}

export function gradeCard(topicId: string, card: SrsCard | undefined, rating: SrsRating, now: number): SrsCard {
  let { ease, intervalDays, reps, lapses } = card ?? {
    ease: STARTING_EASE,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
  };
  reps += 1;

  switch (rating) {
    case 'again':
      intervalDays = 1;
      ease = Math.max(MIN_EASE, ease - 0.2);
      lapses += 1;
      break;
    case 'hard':
      intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
      ease = Math.max(MIN_EASE, ease - 0.15);
      break;
    case 'good':
      intervalDays = Math.max(1, Math.round(intervalDays * ease));
      break;
    case 'easy':
      intervalDays = Math.max(1, Math.round(intervalDays * ease * 1.3));
      ease = ease + 0.15;
      break;
  }

  return { topicId, ease, intervalDays, reps, lapses, dueAt: now + intervalDays * DAY_MS, updatedAt: now };
}

export function getDueTopicIds(topics: Topic[], srsCards: Map<string, SrsCard>, now: number): string[] {
  return topics.filter((topic) => isDue(srsCards.get(topic.id), now)).map((topic) => topic.id);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- srs.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd kb-app
git add src/types.ts src/lib/srs.ts src/lib/srs.test.ts
git commit -m "feat: add SrsCard/SrsRating types and simplified SM-2 algorithm"
```

---

## Task 2: `db.ts` — `srsCards` IndexedDB store (v2→v3)

**Files:**
- Modify: `kb-app/src/lib/db.ts`
- Test: `kb-app/src/lib/db.test.ts`

**Interfaces:**
- Consumes: `SrsCard` from `../types` (Task 1).
- Produces: `getAllSrsCards(): Promise<SrsCard[]>`, `setSrsCard(card: SrsCard): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

In `kb-app/src/lib/db.test.ts`, update the import list:

```ts
import {
  __resetDbForTests,
  getAllFavorites,
  getAllNotes,
  getAllProgress,
  getAllRecents,
  getAllSrsCards,
  recordView,
  setFavorite,
  setNote,
  setProgress,
  setSrsCard,
} from './db';
```

Add this `describe` block (after `describe('db — notes', ...)`, before `describe('db — failure handling', ...)`):

```ts
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
```

Extend the existing failure-handling test — add these two lines after the existing `setNote` assertions (still before `expect(warnSpy).toHaveBeenCalledTimes(1);`):

```ts
    expect(await getAllSrsCards()).toEqual([]);
    await expect(
      setSrsCard({ topicId: 'topic-a', ease: 2.5, intervalDays: 1, dueAt: 1000, reps: 1, lapses: 0, updatedAt: 1000 }),
    ).resolves.toBeUndefined();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- db.test.ts`
Expected: FAIL — `getAllSrsCards`/`setSrsCard` are not exported.

- [ ] **Step 3: Implement the `srsCards` store**

In `kb-app/src/lib/db.ts`, update the import and schema:

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Favorite, Note, Progress, ProgressStatus, Recent, SrsCard } from '../types';

interface KbUserDataSchema extends DBSchema {
  progress: { key: string; value: Progress };
  favorites: { key: string; value: Favorite };
  recents: { key: string; value: Recent };
  notes: { key: string; value: Note };
  srsCards: { key: string; value: SrsCard };
}

const DB_NAME = 'kb-user-data';
const DB_VERSION = 3;
export const RECENTS_LIMIT = 12;
```

Update the `upgrade()` callback to add the new store:

```ts
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
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'topicId' });
        }
        if (!db.objectStoreNames.contains('srsCards')) {
          db.createObjectStore('srsCards', { keyPath: 'topicId' });
        }
      },
```

Add these two functions after `setNote` and before `__resetDbForTests`:

```ts
export async function getAllSrsCards(): Promise<SrsCard[]> {
  try {
    const db = await getDb();
    return await db.getAll('srsCards');
  } catch (error) {
    warnOnce('getAllSrsCards', error);
    return [];
  }
}

/** Takes the fully-computed card (the caller already ran it through
 *  lib/srs.ts's gradeCard) — a single put, no read, same idempotent shape
 *  as setFavorite/setNote. */
export async function setSrsCard(card: SrsCard): Promise<void> {
  try {
    const db = await getDb();
    await db.put('srsCards', card);
  } catch (error) {
    warnOnce('setSrsCard', error);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- db.test.ts`
Expected: PASS, all tests including `describe('db — srsCards', ...)`.

- [ ] **Step 5: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd kb-app
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "feat: add srsCards IndexedDB store (db v2->v3)"
```

---

## Task 3: `userDataStore` — `srsCards` state + `gradeCard` action

**Files:**
- Modify: `kb-app/src/store/userDataStore.ts`
- Test: `kb-app/src/store/userDataStore.test.ts`

**Interfaces:**
- Consumes: `gradeCard(topicId, card, rating, now)` from `../lib/srs` (Task 1); `getAllSrsCards()`, `setSrsCard(card)` from `../lib/db` (Task 2).
- Produces: `UserDataState.srsCards: Map<string, SrsCard>`, `UserDataState.gradeCard: (topicId: string, rating: SrsRating) => void`.

- [ ] **Step 1: Write the failing tests**

In `kb-app/src/store/userDataStore.test.ts`, update `resetStore()`:

```ts
function resetStore() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: false,
  });
}
```

Add a new `describe('gradeCard', ...)` block (after `describe('setNote', ...)`, before `describe('loadUserData', ...)`):

```ts
  describe('gradeCard', () => {
    it('grades a never-reviewed topic and stores the resulting card', () => {
      useUserDataStore.getState().gradeCard('topic-a', 'good');
      const card = useUserDataStore.getState().srsCards.get('topic-a');
      expect(card).toBeDefined();
      expect(card?.reps).toBe(1);
      expect(card?.intervalDays).toBe(1);
    });

    it('grades an existing card from its current state, not starting over', () => {
      useUserDataStore.getState().gradeCard('topic-a', 'good');
      useUserDataStore.getState().gradeCard('topic-a', 'good');
      const card = useUserDataStore.getState().srsCards.get('topic-a');
      expect(card?.reps).toBe(2);
      expect(card?.intervalDays).toBeGreaterThan(1);
    });

    it('persists via db.setSrsCard with the computed card, without the caller awaiting it', () => {
      const setSrsCardSpy = vi.spyOn(db, 'setSrsCard').mockResolvedValue(undefined);
      useUserDataStore.getState().gradeCard('topic-a', 'again');
      expect(setSrsCardSpy).toHaveBeenCalledWith(expect.objectContaining({ topicId: 'topic-a', intervalDays: 1 }));
    });
  });
```

Update the two `loadUserData` tests to also cover `srsCards`. First (rename to mention srsCards too):

```ts
    it('populates progress, favorites (newest-createdAt-first), recents, notes and srsCards, and sets isLoaded', async () => {
      vi.spyOn(db, 'getAllProgress').mockResolvedValue([
        { topicId: 'topic-a', status: 'mastered', updatedAt: 1 },
      ]);
      vi.spyOn(db, 'getAllFavorites').mockResolvedValue([
        { topicId: 'topic-b', createdAt: 1 },
        { topicId: 'topic-c', createdAt: 2 },
      ]);
      vi.spyOn(db, 'getAllRecents').mockResolvedValue([{ topicId: 'topic-a', viewedAt: 1 }]);
      vi.spyOn(db, 'getAllNotes').mockResolvedValue([{ topicId: 'topic-a', text: 'a note', updatedAt: 1 }]);
      vi.spyOn(db, 'getAllSrsCards').mockResolvedValue([
        { topicId: 'topic-a', ease: 2.5, intervalDays: 1, dueAt: 1, reps: 1, lapses: 0, updatedAt: 1 },
      ]);

      await useUserDataStore.getState().loadUserData();

      const state = useUserDataStore.getState();
      expect(state.progress.get('topic-a')).toBe('mastered');
      expect([...state.favorites]).toEqual(['topic-c', 'topic-b']);
      expect(state.recents).toEqual([{ topicId: 'topic-a', viewedAt: 1 }]);
      expect(state.notes.get('topic-a')).toBe('a note');
      expect(state.srsCards.get('topic-a')).toMatchObject({ ease: 2.5, intervalDays: 1 });
      expect(state.isLoaded).toBe(true);
    });
```

Second:

```ts
    it('sets isLoaded true even when the underlying db calls resolve with empty defaults', async () => {
      vi.spyOn(db, 'getAllProgress').mockResolvedValue([]);
      vi.spyOn(db, 'getAllFavorites').mockResolvedValue([]);
      vi.spyOn(db, 'getAllRecents').mockResolvedValue([]);
      vi.spyOn(db, 'getAllNotes').mockResolvedValue([]);
      vi.spyOn(db, 'getAllSrsCards').mockResolvedValue([]);

      await useUserDataStore.getState().loadUserData();
      expect(useUserDataStore.getState().isLoaded).toBe(true);
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- userDataStore.test.ts`
Expected: FAIL — `gradeCard` doesn't exist on the store, `srsCards` is undefined.

- [ ] **Step 3: Implement `srsCards` state + `gradeCard` action**

In `kb-app/src/store/userDataStore.ts`, update the imports:

```ts
import { create } from 'zustand';
import type { ProgressStatus, SrsCard, SrsRating } from '../types';
import { NEXT_STATUS } from '../lib/progressStatus';
import { gradeCard as computeGradedCard } from '../lib/srs';
import {
  getAllFavorites,
  getAllNotes,
  getAllProgress,
  getAllRecents,
  getAllSrsCards,
  RECENTS_LIMIT,
  recordView as persistRecordView,
  setFavorite as persistSetFavorite,
  setNote as persistSetNote,
  setProgress as persistSetProgress,
  setSrsCard as persistSetSrsCard,
} from '../lib/db';
```

Update the `UserDataState` interface:

```ts
interface UserDataState {
  progress: Map<string, ProgressStatus>;
  favorites: Set<string>;
  recents: RecentEntry[];
  notes: Map<string, string>;
  srsCards: Map<string, SrsCard>;
  isLoaded: boolean;

  loadUserData: () => Promise<void>;
  setStatus: (topicId: string, status: ProgressStatus) => void;
  cycleStatus: (topicId: string) => void;
  toggleFavorite: (topicId: string) => void;
  recordView: (topicId: string) => void;
  setNote: (topicId: string, text: string) => void;
  gradeCard: (topicId: string, rating: SrsRating) => void;
}
```

Update the store's initial state and `loadUserData`:

```ts
export const useUserDataStore = create<UserDataState>()((set, get) => ({
  progress: new Map(),
  favorites: new Set(),
  recents: [],
  notes: new Map(),
  srsCards: new Map(),
  isLoaded: false,

  loadUserData: async () => {
    try {
      const [progressRows, favoriteRows, recentRows, noteRows, srsCardRows] = await Promise.all([
        getAllProgress(),
        getAllFavorites(),
        getAllRecents(),
        getAllNotes(),
        getAllSrsCards(),
      ]);
      const favoritesNewestFirst = [...favoriteRows].sort((a, b) => b.createdAt - a.createdAt);
      set({
        progress: new Map(progressRows.map((row) => [row.topicId, row.status])),
        favorites: new Set(favoritesNewestFirst.map((row) => row.topicId)),
        recents: recentRows.map((row) => ({ topicId: row.topicId, viewedAt: row.viewedAt })),
        notes: new Map(noteRows.map((row) => [row.topicId, row.text])),
        srsCards: new Map(srsCardRows.map((row) => [row.topicId, row])),
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },
```

Leave `setStatus`, `cycleStatus`, `toggleFavorite`, `recordView`, `setNote` unchanged, and add `gradeCard` as the last action:

```ts
  gradeCard: (topicId, rating) => {
    const current = get().srsCards.get(topicId);
    const next = computeGradedCard(topicId, current, rating, Date.now());
    set((state) => {
      const nextMap = new Map(state.srsCards);
      nextMap.set(topicId, next);
      return { srsCards: nextMap };
    });
    void persistSetSrsCard(next);
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- userDataStore.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd kb-app
git add src/store/userDataStore.ts src/store/userDataStore.test.ts
git commit -m "feat: add srsCards state and gradeCard action to userDataStore"
```

---

## Task 4: `Header` nav link + due-count badge

**Files:**
- Modify: `kb-app/src/components/layout/Header.tsx`
- Modify: `kb-app/src/components/layout/Header.test.tsx`
- Modify: `kb-app/src/pages/Home.test.tsx` (defensive `srsCards` reset)
- Modify: `kb-app/src/pages/Reader.test.tsx` (defensive `srsCards` reset)

**Interfaces:**
- Consumes: `getDueTopicIds(topics, srsCards, now)` from `../../lib/srs` (Task 1); `userDataStore.srsCards` (Task 3).

Both `Home.tsx` and `Reader.tsx` already render `<Header />`. Header did not previously depend on any store data; after this task it reads `srsCards`, so both pages' test files need `srsCards: new Map()` added to their store resets — without it, a later test in either file that sets `srsCards` non-empty (none exist yet, but this is the same latent-leak class the Phase 3 sub-project #2 final review already caught once) would silently bleed into unrelated tests in the same file.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `kb-app/src/components/layout/Header.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';
import { useUserDataStore } from '../../store/userDataStore';
import topicsData from '../../data/topics.clean.json';

function reset() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
}

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

describe('Header', () => {
  beforeEach(reset);

  it('renders the brand name', () => {
    renderWithRouter();
    expect(screen.getByText('מסד ידע')).toBeInTheDocument();
    expect(screen.getByText('AI Engineer')).toBeInTheDocument();
  });

  it('renders the theme toggle button', () => {
    renderWithRouter();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses the header landmark', () => {
    renderWithRouter();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders a link to the Flashcards page', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: /כרטיסיות/ })).toHaveAttribute('href', '/flashcards');
  });

  it('shows a due-count badge when cards are due (every topic starts never-reviewed = due)', () => {
    renderWithRouter();
    expect(screen.getByLabelText(`${topicsData.length} כרטיסים ממתינים לחזרה`)).toBeInTheDocument();
  });

  it('hides the badge when nothing is due', () => {
    const now = Date.now();
    const farFuture = now + 1000 * 60 * 60 * 24 * 365;
    const allNotDue = new Map(
      topicsData.map((t) => [
        t.id,
        { topicId: t.id, ease: 2.5, intervalDays: 365, dueAt: farFuture, reps: 1, lapses: 0, updatedAt: now },
      ]),
    );
    useUserDataStore.setState({ srsCards: allNotDue });
    renderWithRouter();
    expect(screen.queryByText(/כרטיסים ממתינים לחזרה/)).not.toBeInTheDocument();
  });
});
```

In `kb-app/src/pages/Home.test.tsx`, add `srsCards: new Map()` to the existing `reset()`'s `useUserDataStore.setState` call:

```ts
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
```

In `kb-app/src/pages/Reader.test.tsx`, make the identical addition to its `beforeEach`'s `useUserDataStore.setState` call.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- Header.test.tsx`
Expected: FAIL — no link with accessible name matching `/כרטיסיות/`, `srsCards` undefined crashes the render (`Cannot read properties of undefined (reading 'get')`).

- [ ] **Step 3: Implement the nav link and badge**

Replace the entire contents of `kb-app/src/components/layout/Header.tsx`:

```tsx
import { Link } from 'react-router-dom';
import topicsRaw from '../../data/topics.clean.json';
import type { Topic } from '../../types';
import { getDueTopicIds } from '../../lib/srs';
import { useUserDataStore } from '../../store/userDataStore';
import ThemeToggle from '../theme/ThemeToggle';

const topics = topicsRaw as Topic[];

export default function Header() {
  const srsCards = useUserDataStore((s) => s.srsCards);
  const dueCount = getDueTopicIds(topics, srsCards, Date.now()).length;

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--kb-border)] bg-[var(--kb-surface)] px-4 py-3 shadow-[var(--kb-shadow-sm)]">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-xl">🧠</span>
        <div className="flex flex-col leading-tight">
          <strong className="text-[var(--kb-text)]">מסד ידע</strong>
          <span className="text-xs text-[var(--kb-muted)]">AI Engineer</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to="/flashcards"
          className="flex min-h-11 items-center rounded-md px-3 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
        >
          כרטיסיות
          {dueCount > 0 && (
            <span
              className="ms-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--kb-accent-soft)] px-1.5 text-xs font-bold text-[var(--kb-accent)]"
              aria-label={`${dueCount} כרטיסים ממתינים לחזרה`}
            >
              {dueCount}
            </span>
          )}
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- Header.test.tsx Home.test.tsx Reader.test.tsx`
Expected: PASS, all tests in all three files.

- [ ] **Step 5: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd kb-app
git add src/components/layout/Header.tsx src/components/layout/Header.test.tsx src/pages/Home.test.tsx src/pages/Reader.test.tsx
git commit -m "feat: add Flashcards nav link with due-count badge to Header"
```

---

## Task 5: `Flashcards` page + routing

**Files:**
- Create: `kb-app/src/pages/Flashcards.tsx`
- Create: `kb-app/src/pages/Flashcards.test.tsx`
- Modify: `kb-app/src/App.tsx`
- Modify: `kb-app/src/App.test.tsx`

**Interfaces:**
- Consumes: `isDue` from `../lib/srs` (Task 1); `userDataStore.progress`, `userDataStore.srsCards`, `userDataStore.gradeCard(topicId, rating)` (Task 3); `ALL_STATUSES`, `STATUS_LABELS` from `../lib/progressStatus` (existing).
- Produces: `Flashcards` default export, mounted at route `/flashcards`.

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/pages/Flashcards.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Flashcards from './Flashcards';
import { useUserDataStore } from '../store/userDataStore';
import topicsData from '../data/topics.clean.json';

function reset() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Flashcards />
    </MemoryRouter>,
  );
}

describe('Flashcards', () => {
  beforeEach(reset);

  it("shows the first card's title with a reveal control, hiding the definition", () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'לחץ לחשיפה' })).toBeInTheDocument();
    expect(screen.getByText(`1 מתוך ${topicsData.length}`)).toBeInTheDocument();
  });

  it('reveals the definition, full-reader link and rating buttons on click', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'לחץ לחשיפה' }));
    expect(screen.getByRole('button', { name: 'שוב' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'קשה' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'טוב' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'קל' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'פתח את הנושא המלא' })).toBeInTheDocument();
  });

  it('rating a card grades it in the store and advances to the next card', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'לחץ לחשיפה' }));
    await user.click(screen.getByRole('button', { name: 'טוב' }));

    expect(useUserDataStore.getState().srsCards.size).toBe(1);
    expect(screen.getByText(`2 מתוך ${topicsData.length}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'לחץ לחשיפה' })).toBeInTheDocument();
  });

  it('narrows the queue when a module filter is chosen', async () => {
    const user = userEvent.setup();
    renderPage();
    const moduleCount = topicsData.filter((t) => t.module === topicsData[0].module).length;

    await user.selectOptions(screen.getByLabelText('מודול'), topicsData[0].module);
    expect(screen.getByText(`1 מתוך ${moduleCount}`)).toBeInTheDocument();
  });

  it('shows an empty-queue message when no topics match the filters', async () => {
    useUserDataStore.setState({ progress: new Map(topicsData.map((t) => [t.id, 'mastered' as const])) });
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText('מצב למידה'), 'new');
    expect(screen.getByRole('status')).toHaveTextContent('אין כרטיסים לחזרה');
  });

  it('shows an end-of-session message after rating the only matching card', async () => {
    const progress = new Map(topicsData.map((t) => [t.id, 'mastered' as const]));
    progress.set(topicsData[0].id, 'new');
    useUserDataStore.setState({ progress });
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText('מצב למידה'), 'new');
    expect(screen.getByText('1 מתוך 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'לחץ לחשיפה' }));
    await user.click(screen.getByRole('button', { name: 'טוב' }));
    expect(screen.getByRole('status')).toHaveTextContent('סיימת! 1 כרטיסים נסקרו.');
  });

  it('reveals via Space and rates via number keys 1-4', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'שוב' })).toBeInTheDocument();
    await user.keyboard('3');
    expect(useUserDataStore.getState().srsCards.size).toBe(1);
    expect(screen.getByText(`2 מתוך ${topicsData.length}`)).toBeInTheDocument();
  });
});
```

Update `kb-app/src/App.tsx`'s import block and routes (Step 3 covers the source change; here's the test first). Add to `kb-app/src/App.test.tsx`: update its `beforeEach`'s `useUserDataStore.setState` call to include `srsCards: new Map()`:

```ts
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
```

And add a new test at the end of `describe('App', ...)`:

```tsx
  it('renders the Flashcards page at "/flashcards"', () => {
    render(
      <MemoryRouter initialEntries={['/flashcards']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'כרטיסיות' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- Flashcards.test.tsx App.test.tsx`
Expected: FAIL — `./Flashcards` does not exist; `/flashcards` renders nothing matching.

- [ ] **Step 3: Implement `Flashcards.tsx` and wire the route**

Create `kb-app/src/pages/Flashcards.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import type { ModulesMap, ProgressStatus, SrsRating, Topic } from '../types';
import { isDue } from '../lib/srs';
import { ALL_STATUSES, STATUS_LABELS } from '../lib/progressStatus';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const topicsById = new Map(topics.map((t) => [t.id, t]));
const categoryLabels: Record<string, string> = Object.fromEntries(
  topics.map((t) => [t.category, t.category_label]),
);

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function Flashcards() {
  const gradeCard = useUserDataStore((s) => s.gradeCard);

  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<ProgressStatus | 'all'>('all');
  const [dueOnly, setDueOnly] = useState(true);

  const [queue, setQueue] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Rebuilds the session queue only when a filter selection changes.
  // progress/srsCards are read imperatively via getState() (a plain
  // function call, not a reactive hook value) so grading a card mid-session
  // never reshuffles or restarts the queue — the queue is a frozen snapshot
  // of "what matched when you set these filters."
  useEffect(() => {
    const now = Date.now();
    let candidates = topics;
    if (selectedModule !== 'all') candidates = candidates.filter((t) => t.module === selectedModule);
    if (selectedCategory !== 'all') candidates = candidates.filter((t) => t.category === selectedCategory);
    if (selectedStatus !== 'all') {
      const liveProgress = useUserDataStore.getState().progress;
      candidates = candidates.filter((t) => (liveProgress.get(t.id) ?? 'new') === selectedStatus);
    }
    if (dueOnly) {
      const liveSrsCards = useUserDataStore.getState().srsCards;
      candidates = candidates.filter((t) => isDue(liveSrsCards.get(t.id), now));
    }
    setQueue(shuffle(candidates.map((t) => t.id)));
    setCurrentIndex(0);
    setRevealed(false);
    setReviewedCount(0);
  }, [selectedModule, selectedCategory, selectedStatus, dueOnly]);

  const currentTopicId = queue[currentIndex];
  const currentTopic = currentTopicId ? topicsById.get(currentTopicId) : undefined;
  const queueEmpty = queue.length === 0;
  const sessionDone = !queueEmpty && currentIndex >= queue.length;

  function handleRate(rating: SrsRating) {
    if (!currentTopicId) return;
    gradeCard(currentTopicId, rating);
    setReviewedCount((n) => n + 1);
    setCurrentIndex((i) => i + 1);
    setRevealed(false);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isTyping =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement;
      if (isTyping || !currentTopic) return;

      if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed) {
        const ratingByKey: Record<string, SrsRating> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
        const rating = ratingByKey[event.key];
        if (rating) {
          event.preventDefault();
          handleRate(rating);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [revealed, currentTopic, currentTopicId]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl p-4">
        <h1 className="mb-4 text-xl font-bold text-[var(--kb-text)]">כרטיסיות</h1>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="flex flex-col text-sm text-[var(--kb-text)]">
            מודול
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
            >
              <option value="all">הכול</option>
              {Object.entries(modules).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm text-[var(--kb-text)]">
            קטגוריה
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
            >
              <option value="all">הכול</option>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm text-[var(--kb-text)]">
            מצב למידה
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ProgressStatus | 'all')}
              className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
            >
              <option value="all">הכול</option>
              {ALL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--kb-text)]">
            <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} />
            רק כרטיסים לחזרה היום
          </label>
        </div>

        {queueEmpty && (
          <p role="status" className="text-[var(--kb-muted)]">
            אין כרטיסים לחזרה.
          </p>
        )}

        {!queueEmpty && sessionDone && (
          <p role="status" className="text-[var(--kb-text)]">{`סיימת! ${reviewedCount} כרטיסים נסקרו.`}</p>
        )}

        {currentTopic && (
          <div className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-6 text-center shadow-[var(--kb-shadow-sm)]">
            <p className="mb-1 text-sm text-[var(--kb-muted)]">{`${currentIndex + 1} מתוך ${queue.length}`}</p>
            <h2 className="mb-4 text-xl font-bold text-[var(--kb-text)]">{currentTopic.title}</h2>
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="min-h-11 rounded-md border border-[var(--kb-border)] px-4 text-[var(--kb-text)]"
              >
                לחץ לחשיפה
              </button>
            ) : (
              <>
                <p className="mb-4 text-[var(--kb-text2)]">{currentTopic.definition}</p>
                <Link
                  to={`/topic/${encodeURIComponent(currentTopic.id)}`}
                  className="mb-4 inline-block text-sm text-[var(--kb-accent)] underline"
                >
                  פתח את הנושא המלא
                </Link>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRate('again')}
                    className="min-h-11 rounded-md border border-[var(--kb-border)] px-3 text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
                  >
                    שוב
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate('hard')}
                    className="min-h-11 rounded-md border border-[var(--kb-border)] px-3 text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
                  >
                    קשה
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate('good')}
                    className="min-h-11 rounded-md border border-[var(--kb-border)] px-3 text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
                  >
                    טוב
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate('easy')}
                    className="min-h-11 rounded-md border border-[var(--kb-border)] px-3 text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
                  >
                    קל
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
```

In `kb-app/src/App.tsx`, add the import and route:

```tsx
import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';
import Flashcards from './pages/Flashcards';
import { useUserDataStore } from './store/userDataStore';

export default function App() {
  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/topic/:id" element={<Reader />} />
      <Route path="/flashcards" element={<Flashcards />} />
    </Routes>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- Flashcards.test.tsx App.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 5: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd kb-app
git add src/pages/Flashcards.tsx src/pages/Flashcards.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: add Flashcards page with session queue, reveal/rate flow and keyboard shortcuts"
```

---

## Task 6: Home's Daily Review card

**Files:**
- Create: `kb-app/src/components/layout/DailyReviewCard.tsx`
- Create: `kb-app/src/components/layout/DailyReviewCard.test.tsx`
- Modify: `kb-app/src/pages/Home.tsx`
- Modify: `kb-app/src/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `getDueTopicIds` from `../../lib/srs` (Task 1); `userDataStore.srsCards` (Task 3).
- Produces: `DailyReviewCard({ dueCount: number; randomTopic: Topic })` default export.

This is the final task — Step 6 below is the full-suite verification gate.

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/components/layout/DailyReviewCard.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DailyReviewCard from './DailyReviewCard';
import type { Topic } from '../../types';

const randomTopic: Topic = {
  id: 'topic-x',
  module: 'm',
  module_label: 'M',
  category: 'concepts',
  category_label: 'C',
  num: 1,
  slug_name: 'x',
  title: 'Random Topic Title',
  definition: 'd',
  related_raw: [],
  related_match: [],
  contentPath: '/x.html',
};

function renderCard(dueCount: number) {
  return render(
    <MemoryRouter>
      <DailyReviewCard dueCount={dueCount} randomTopic={randomTopic} />
    </MemoryRouter>,
  );
}

describe('DailyReviewCard', () => {
  it('shows the due count', () => {
    renderCard(7);
    expect(screen.getByText('7 ממתינים היום')).toBeInTheDocument();
  });

  it('links "start review" to /flashcards', () => {
    renderCard(7);
    expect(screen.getByRole('link', { name: 'התחל חזרה' })).toHaveAttribute('href', '/flashcards');
  });

  it('links the random concept to its topic reader page', () => {
    renderCard(7);
    expect(screen.getByRole('link', { name: /Random Topic Title/ })).toHaveAttribute('href', '/topic/topic-x');
  });
});
```

Add to `kb-app/src/pages/Home.test.tsx`'s `reset()`, include `srsCards: new Map()`:

```ts
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
```

Add two new tests at the end of `describe('Home', ...)`:

```tsx
  it('renders the Daily Review card with the correct due count and a random-concept link', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(`${topicsData.length} ממתינים היום`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'התחל חזרה' })).toHaveAttribute('href', '/flashcards');
    const randomLink = screen.getByRole('link', { name: /מושג אקראי/ });
    const linkedId = decodeURIComponent(randomLink.getAttribute('href')!.replace('/topic/', ''));
    expect(topicsData.some((t) => t.id === linkedId)).toBe(true);
  });

  it('the due count reflects graded cards', () => {
    const now = Date.now();
    useUserDataStore.setState({
      srsCards: new Map([
        [
          topicsData[0].id,
          {
            topicId: topicsData[0].id,
            ease: 2.5,
            intervalDays: 30,
            dueAt: now + 1000 * 60 * 60 * 24 * 30,
            reps: 1,
            lapses: 0,
            updatedAt: now,
          },
        ],
      ]),
    });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(`${topicsData.length - 1} ממתינים היום`)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- DailyReviewCard.test.tsx Home.test.tsx`
Expected: FAIL — `./DailyReviewCard` does not exist; Home doesn't render the due-count text yet.

- [ ] **Step 3: Implement `DailyReviewCard.tsx` and wire it into `Home.tsx`**

Create `kb-app/src/components/layout/DailyReviewCard.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { Topic } from '../../types';

interface DailyReviewCardProps {
  dueCount: number;
  randomTopic: Topic;
}

export default function DailyReviewCard({ dueCount, randomTopic }: DailyReviewCardProps) {
  return (
    <div className="mx-4 mb-6 rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-4 shadow-[var(--kb-shadow-sm)] md:mx-auto md:max-w-2xl">
      <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">היום ללמידה</h2>
      <p className="mb-3 text-[var(--kb-text)]">{`${dueCount} ממתינים היום`}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/flashcards"
          className="min-h-11 rounded-md border border-[var(--kb-border)] px-3 py-2 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
        >
          התחל חזרה
        </Link>
        <Link
          to={`/topic/${encodeURIComponent(randomTopic.id)}`}
          className="flex min-h-11 items-center px-3 py-2 text-sm text-[var(--kb-accent)] underline"
        >
          {`מושג אקראי: ${randomTopic.title}`}
        </Link>
      </div>
    </div>
  );
}
```

In `kb-app/src/pages/Home.tsx`, update the import block:

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
import { getDueTopicIds } from '../lib/srs';
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav';
import { useUiStore } from '../store/uiStore';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';
import Hero from '../components/layout/Hero';
import DailyReviewCard from '../components/layout/DailyReviewCard';
import Sidebar from '../components/layout/Sidebar';
import ShortcutsHelp from '../components/layout/ShortcutsHelp';
import SearchBar from '../components/browse/SearchBar';
import FilterChips from '../components/browse/FilterChips';
import SortMenu from '../components/browse/SortMenu';
import ViewToggle from '../components/browse/ViewToggle';
import AccordionGroup from '../components/browse/AccordionGroup';
```

Add two new reads and two new `useMemo`s inside `Home()`, alongside the existing `const notes = useUserDataStore((s) => s.notes);` line:

```tsx
  const notes = useUserDataStore((s) => s.notes);
  const srsCards = useUserDataStore((s) => s.srsCards);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const dueCount = useMemo(() => getDueTopicIds(topics, srsCards, Date.now()).length, [srsCards]);
  // Chosen once per mount — a stable "discover something" nudge, not meant
  // to re-roll on every unrelated re-render.
  const randomTopic = useMemo(() => topics[Math.floor(Math.random() * topics.length)], []);
```

(`const [shortcutsOpen, setShortcutsOpen] = useState(false);` already existed right after `const notes = ...` — keep it in place, just insert the two new lines around it as shown.)

Render `<DailyReviewCard>` right after `<Hero>`:

```tsx
      <Header />
      <Hero topicCount={topics.length} moduleCount={Object.keys(modules).length} masteredCount={masteredCount} />
      <DailyReviewCard dueCount={dueCount} randomTopic={randomTopic} />
      <div className="flex flex-col md:flex-row">
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- DailyReviewCard.test.tsx Home.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 5: Run the full test suite and typecheck/lint**

Run: `cd kb-app && npm run test`
Expected: PASS, every test file in the project (no regressions to Phase 2 or Phase 3 sub-projects #1-#2).

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Full-suite verification gate**

```bash
cd kb-app
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: everything green.

- [ ] **Step 7: Commit**

```bash
cd kb-app
git add src/components/layout/DailyReviewCard.tsx src/components/layout/DailyReviewCard.test.tsx src/pages/Home.tsx src/pages/Home.test.tsx
git commit -m "feat: add Daily Review card to Home"
```

---

## Critical files
- `kb-app/src/lib/srs.ts`
- `kb-app/src/lib/db.ts`
- `kb-app/src/store/userDataStore.ts`
- `kb-app/src/pages/Flashcards.tsx`
- `kb-app/src/components/layout/Header.tsx`
- `kb-app/src/components/layout/DailyReviewCard.tsx`
- `kb-app/src/pages/Home.tsx`

## Verification (end-to-end, after Task 6)
1. `npm run typecheck && npm run lint && npm run test && npm run build` all green.
2. `npm run dev` — manually confirm: a brand-new install shows all 160 topics as due (Header badge = 160, Daily Review card = "160 ממתינים היום"); opening `/flashcards` and rating a card removes it from today's queue and changes its due date; module/category/status/due-only filters narrow the deck correctly; rating "Again" does not bring the card back later in the same session; the random-concept link and "start review" link both work; grading never changes the topic's separate progress status (check in the reader).
3. Repeat in dark theme and RTL (already default) — check keyboard-only: Tab through the filters, Space/Enter to reveal, 1-4 to rate, all the way through a full session to the end-of-session message.
4. Test in a private/incognito window (or simulate an IndexedDB failure) to confirm SRS state silently no-ops rather than crashing.

## Repo convention note
This repo tracks implementation via `.superpowers/sdd/<plan-name>/progress.md` (one task = one commit, reviewed before moving on) and task briefs under the same directory. Once this plan is approved, follow that existing convention for execution.
