# Phase 3, Sub-project #2 — Personal Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user write a free-text personal note on any topic in the reader, autosaved with a debounce, persisted locally in IndexedDB, optionally searchable.

**Architecture:** A fourth `kb-user-data` IndexedDB store (`notes`, version bump 1→2) plus a `notes: Map<string, string>` slice on the existing write-through `userDataStore`, following the exact pattern `progress`/`favorites`/`recents` already established. A new `TopicNotes` component owns the debounce (component-local, not store-level) and renders in `TopicReader`. `filterTopics` gains an optional notes parameter so search can be extended to note text without becoming store-aware itself.

**Tech Stack:** React 19, TypeScript, Zustand, `idb` (already a dependency), Vitest + Testing Library + `fake-indexeddb` (already configured).

**Spec:** `docs/superpowers/specs/2026-09-06-phase3-notes-design.md`

## Global Constraints

- `topic.id` is the sole key for all user data (golden rule 2) — `notes` store is keyed by `topicId`, same as every other store.
- Local-first: the app must keep working fully offline; every `db.ts` function catches its own errors, `console.warn`s at most once per session (never `console.error`), and returns a safe default (golden rule 3, matches existing `warnOnce` pattern).
- User data lives in IndexedDB, not `localStorage` (golden rule 4).
- RTL and both light/dark themes must work on every new UI element (golden rule 5) — no new UI in this plan needs theme-specific styling since it only uses existing `--kb-*` tokens and native form controls that already inherit the global `:focus-visible` rule.
- Accessibility is required on every interactive element: `focus-visible` (already global), keyboard operability, a real `<label>` associated to its control (golden rule 6).
- Colors only via `--kb-*` tokens, no hardcoded values (golden rule 7).
- Absence of a record means the default state — an empty/whitespace-only note **deletes** its row rather than storing `''`, matching `progress`/`favorites`' existing convention (spec, "Data model").
- The autosave debounce is exactly **500ms**, and lives in the `TopicNotes` component, not the store action (spec, "Storage & state architecture").
- `filterTopics` stays a pure function with no store import; the new `notes` parameter is optional and defaults to no notes-matching, so every existing call site's behavior is unchanged if the parameter is omitted (spec, "UI integration").
- The "include notes in search" toggle (`uiStore.includeNotesInSearch`) does not persist across reloads — it is session-only UI state (spec, "Storage & state architecture").
- Reader-only surface for this sub-project: no changes to `TopicCard`, `TopicListRow`, or `Sidebar` (spec, "Out of scope").

---

## Task 1: Foundation — `Note` type + `db.ts` notes store

**Files:**
- Modify: `kb-app/src/types.ts`
- Modify: `kb-app/src/lib/db.ts`
- Test: `kb-app/src/lib/db.test.ts`

**Interfaces:**
- Produces: `Note { topicId: string; text: string; updatedAt: number }` (in `src/types.ts`); `getAllNotes(): Promise<Note[]>` and `setNote(topicId: string, text: string): Promise<void>` (in `src/lib/db.ts`).

- [ ] **Step 1: Add the `Note` type**

Append to `kb-app/src/types.ts` (after the existing `Recent` interface):

```ts
export interface Note {
  topicId: string;
  text: string;
  updatedAt: number;
}
```

- [ ] **Step 2: Write the failing tests**

Add to `kb-app/src/lib/db.test.ts`. First, update the import list at the top of the file to also import `getAllNotes` and `setNote`:

```ts
import {
  __resetDbForTests,
  getAllFavorites,
  getAllNotes,
  getAllProgress,
  getAllRecents,
  recordView,
  setFavorite,
  setNote,
  setProgress,
} from './db';
```

Then add this new `describe` block (anywhere after the existing `describe('db — recents', ...)` block, before `describe('db — failure handling', ...)`):

```ts
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
```

Finally, extend the existing failure-handling test so notes are covered by the same single-warning contract. In `describe('db — failure handling', ...)`, inside the `it('resolves with safe defaults and warns exactly once...')` test, add these two lines directly after the existing `recordView` assertions (still before `expect(warnSpy).toHaveBeenCalledTimes(1);`):

```ts
    expect(await getAllNotes()).toEqual([]);
    await expect(setNote('topic-a', 'text')).resolves.toBeUndefined();
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- db.test.ts`
Expected: FAIL — `getAllNotes`/`setNote` are not exported from `./db`.

- [ ] **Step 4: Implement `notes` store in `db.ts`**

In `kb-app/src/lib/db.ts`, update the top-of-file import and schema:

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Favorite, Note, Progress, ProgressStatus, Recent } from '../types';

interface KbUserDataSchema extends DBSchema {
  progress: { key: string; value: Progress };
  favorites: { key: string; value: Favorite };
  recents: { key: string; value: Recent };
  notes: { key: string; value: Note };
}

const DB_NAME = 'kb-user-data';
const DB_VERSION = 2;
export const RECENTS_LIMIT = 12;
```

Update the `upgrade()` callback to add the new store alongside the existing three (the `if (!db.objectStoreNames.contains(...))` guards mean v1 users upgrade with no data loss):

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
      },
```

Add these two functions after `recordView` and before `__resetDbForTests`:

```ts
export async function getAllNotes(): Promise<Note[]> {
  try {
    const db = await getDb();
    return await db.getAll('notes');
  } catch (error) {
    warnOnce('getAllNotes', error);
    return [];
  }
}

/** Idempotent, same shape as setFavorite: the caller already knows the final
 *  text, so a single put/delete needs no read-then-write. Empty or
 *  whitespace-only text deletes the row — absence of a record means "no
 *  note," matching progress/favorites' existing convention. */
export async function setNote(topicId: string, text: string): Promise<void> {
  try {
    const db = await getDb();
    if (text.trim() === '') {
      await db.delete('notes', topicId);
    } else {
      await db.put('notes', { topicId, text, updatedAt: Date.now() });
    }
  } catch (error) {
    warnOnce('setNote', error);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- db.test.ts`
Expected: PASS, all tests in the file including the new `describe('db — notes', ...)` block.

- [ ] **Step 6: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd kb-app
git add src/types.ts src/lib/db.ts src/lib/db.test.ts
git commit -m "feat: add Note type and notes IndexedDB store (db v1->v2)"
```

---

## Task 2: `userDataStore` notes state + `setNote` action

**Files:**
- Modify: `kb-app/src/store/userDataStore.ts`
- Test: `kb-app/src/store/userDataStore.test.ts`

**Interfaces:**
- Consumes: `getAllNotes(): Promise<Note[]>`, `setNote(topicId: string, text: string): Promise<void>` from `../lib/db` (Task 1).
- Produces: `UserDataState.notes: Map<string, string>`, `UserDataState.setNote: (topicId: string, text: string) => void`.

- [ ] **Step 1: Write the failing tests**

In `kb-app/src/store/userDataStore.test.ts`, update the `resetStore()` helper to include the new field:

```ts
function resetStore() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    isLoaded: false,
  });
}
```

Add a new `describe('setNote', ...)` block (anywhere after `describe('recordView', ...)`, before `describe('loadUserData', ...)`):

```ts
  describe('setNote', () => {
    it('sets note text for a topic', () => {
      useUserDataStore.getState().setNote('topic-a', 'hello');
      expect(useUserDataStore.getState().notes.get('topic-a')).toBe('hello');
    });

    it('deletes the note when text is empty or whitespace-only', () => {
      useUserDataStore.getState().setNote('topic-a', 'hello');
      useUserDataStore.getState().setNote('topic-a', '   ');
      expect(useUserDataStore.getState().notes.has('topic-a')).toBe(false);
    });

    it('persists via db.setNote with the exact text, without the caller awaiting it', () => {
      const setNoteSpy = vi.spyOn(db, 'setNote').mockResolvedValue(undefined);
      useUserDataStore.getState().setNote('topic-a', 'hello');
      expect(setNoteSpy).toHaveBeenCalledWith('topic-a', 'hello');
    });
  });
```

Update `describe('loadUserData', ...)`'s two existing tests. In the first (`'populates progress, favorites (newest-createdAt-first) and recents, and sets isLoaded'`), add a notes mock and assertion:

```ts
    it('populates progress, favorites (newest-createdAt-first), recents and notes, and sets isLoaded', async () => {
      vi.spyOn(db, 'getAllProgress').mockResolvedValue([
        { topicId: 'topic-a', status: 'mastered', updatedAt: 1 },
      ]);
      vi.spyOn(db, 'getAllFavorites').mockResolvedValue([
        { topicId: 'topic-b', createdAt: 1 },
        { topicId: 'topic-c', createdAt: 2 },
      ]);
      vi.spyOn(db, 'getAllRecents').mockResolvedValue([{ topicId: 'topic-a', viewedAt: 1 }]);
      vi.spyOn(db, 'getAllNotes').mockResolvedValue([{ topicId: 'topic-a', text: 'a note', updatedAt: 1 }]);

      await useUserDataStore.getState().loadUserData();

      const state = useUserDataStore.getState();
      expect(state.progress.get('topic-a')).toBe('mastered');
      expect([...state.favorites]).toEqual(['topic-c', 'topic-b']);
      expect(state.recents).toEqual([{ topicId: 'topic-a', viewedAt: 1 }]);
      expect(state.notes.get('topic-a')).toBe('a note');
      expect(state.isLoaded).toBe(true);
    });
```

(This replaces the existing test of the same name — the title and body both change to cover `notes`.)

In the second (`'sets isLoaded true even when the underlying db calls resolve with empty defaults'`), add the notes mock:

```ts
    it('sets isLoaded true even when the underlying db calls resolve with empty defaults', async () => {
      vi.spyOn(db, 'getAllProgress').mockResolvedValue([]);
      vi.spyOn(db, 'getAllFavorites').mockResolvedValue([]);
      vi.spyOn(db, 'getAllRecents').mockResolvedValue([]);
      vi.spyOn(db, 'getAllNotes').mockResolvedValue([]);

      await useUserDataStore.getState().loadUserData();
      expect(useUserDataStore.getState().isLoaded).toBe(true);
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- userDataStore.test.ts`
Expected: FAIL — `setNote` does not exist on the store, `notes` is undefined, `db.getAllNotes` is not a mockable export yet from the store's perspective (it exists after Task 1, but the store doesn't call it).

- [ ] **Step 3: Implement `notes` state + `setNote` action**

In `kb-app/src/store/userDataStore.ts`, update the import block:

```ts
import { create } from 'zustand';
import type { ProgressStatus } from '../types';
import { NEXT_STATUS } from '../lib/progressStatus';
import {
  getAllFavorites,
  getAllNotes,
  getAllProgress,
  getAllRecents,
  RECENTS_LIMIT,
  recordView as persistRecordView,
  setFavorite as persistSetFavorite,
  setNote as persistSetNote,
  setProgress as persistSetProgress,
} from '../lib/db';
```

Update the `UserDataState` interface:

```ts
interface UserDataState {
  progress: Map<string, ProgressStatus>;
  favorites: Set<string>;
  recents: RecentEntry[];
  notes: Map<string, string>;
  isLoaded: boolean;

  loadUserData: () => Promise<void>;
  setStatus: (topicId: string, status: ProgressStatus) => void;
  cycleStatus: (topicId: string) => void;
  toggleFavorite: (topicId: string) => void;
  recordView: (topicId: string) => void;
  setNote: (topicId: string, text: string) => void;
}
```

Update the store body's initial state and `loadUserData`:

```ts
export const useUserDataStore = create<UserDataState>()((set, get) => ({
  progress: new Map(),
  favorites: new Set(),
  recents: [],
  notes: new Map(),
  isLoaded: false,

  loadUserData: async () => {
    try {
      const [progressRows, favoriteRows, recentRows, noteRows] = await Promise.all([
        getAllProgress(),
        getAllFavorites(),
        getAllRecents(),
        getAllNotes(),
      ]);
      const favoritesNewestFirst = [...favoriteRows].sort((a, b) => b.createdAt - a.createdAt);
      set({
        progress: new Map(progressRows.map((row) => [row.topicId, row.status])),
        favorites: new Set(favoritesNewestFirst.map((row) => row.topicId)),
        recents: recentRows.map((row) => ({ topicId: row.topicId, viewedAt: row.viewedAt })),
        notes: new Map(noteRows.map((row) => [row.topicId, row.text])),
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },
```

Leave `setStatus`, `cycleStatus`, `toggleFavorite`, `recordView` unchanged, and add `setNote` as the last action in the object:

```ts
  setNote: (topicId, text) => {
    set((state) => {
      const next = new Map(state.notes);
      if (text.trim() === '') {
        next.delete(topicId);
      } else {
        next.set(topicId, text);
      }
      return { notes: next };
    });
    void persistSetNote(topicId, text);
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- userDataStore.test.ts`
Expected: PASS, all tests including `describe('setNote', ...)` and the updated `loadUserData` tests.

- [ ] **Step 5: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd kb-app
git add src/store/userDataStore.ts src/store/userDataStore.test.ts
git commit -m "feat: add notes state and setNote action to userDataStore"
```

---

## Task 3: `TopicNotes` component

**Files:**
- Create: `kb-app/src/components/topic/TopicNotes.tsx`
- Test: `kb-app/src/components/topic/TopicNotes.test.tsx`

**Interfaces:**
- Consumes: `useUserDataStore` — `notes: Map<string, string>`, `setNote: (topicId: string, text: string) => void` (Task 2).
- Produces: `TopicNotes({ topicId: string })` — default export, rendered by `TopicReader` (Task 4).

This component owns the entire debounce lifecycle: local state for zero-latency typing (same pattern `SearchBar.tsx` already uses for its own debounce), a pending-timeout ref cleared both by a new keystroke and by unmount, an immediate flush on blur, and a resync effect for when the parent re-renders with a **different** `topicId` without unmounting (this happens in practice: `Reader.tsx` reuses one `TopicReader` instance across `/topic/:id` navigations rather than remounting it — see `kb-app/src/pages/Reader.tsx`, no `key` prop on `<TopicReader>`).

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/components/topic/TopicNotes.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicNotes from './TopicNotes';
import { useUserDataStore } from '../../store/userDataStore';

function reset() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    isLoaded: true,
  });
}

describe('TopicNotes', () => {
  beforeEach(() => {
    reset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('renders a labeled, empty textarea when there is no existing note', () => {
    render(<TopicNotes topicId="topic-a" />);
    expect(screen.getByLabelText('ההערות שלי')).toHaveValue('');
  });

  it('renders the existing note text as the initial value', () => {
    useUserDataStore.setState({ notes: new Map([['topic-a', 'existing note']]) });
    render(<TopicNotes topicId="topic-a" />);
    expect(screen.getByLabelText('ההערות שלי')).toHaveValue('existing note');
  });

  it('commits to the store only after 500ms of no further typing', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicNotes topicId="topic-a" />);
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.type(textarea, 'hi');
    expect(useUserDataStore.getState().notes.get('topic-a')).toBeUndefined();

    vi.advanceTimersByTime(499);
    expect(useUserDataStore.getState().notes.get('topic-a')).toBeUndefined();

    vi.advanceTimersByTime(1);
    expect(useUserDataStore.getState().notes.get('topic-a')).toBe('hi');
  });

  it('resets the debounce timer on every keystroke (no save mid-typing)', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicNotes topicId="topic-a" />);
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.type(textarea, 'a');
    vi.advanceTimersByTime(400);
    await user.type(textarea, 'b');
    vi.advanceTimersByTime(400);
    expect(useUserDataStore.getState().notes.get('topic-a')).toBeUndefined();

    vi.advanceTimersByTime(100);
    expect(useUserDataStore.getState().notes.get('topic-a')).toBe('ab');
  });

  it('flushes immediately on blur instead of waiting for the debounce', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <>
        <TopicNotes topicId="topic-a" />
        <button type="button">elsewhere</button>
      </>,
    );
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.type(textarea, 'hi');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(useUserDataStore.getState().notes.get('topic-a')).toBe('hi');
  });

  it('clearing the text back to empty removes the note from the store', async () => {
    useUserDataStore.setState({ notes: new Map([['topic-a', 'existing']]) });
    const user = userEvent.setup({ delay: null });
    render(<TopicNotes topicId="topic-a" />);
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.clear(textarea);
    vi.advanceTimersByTime(500);
    expect(useUserDataStore.getState().notes.has('topic-a')).toBe(false);
  });

  it('does not persist after unmount even if a debounce was pending', async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = render(<TopicNotes topicId="topic-a" />);
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.type(textarea, 'hi');
    unmount();
    vi.advanceTimersByTime(500);
    expect(useUserDataStore.getState().notes.get('topic-a')).toBeUndefined();
  });

  it('resyncs its value when topicId changes without unmounting', () => {
    useUserDataStore.setState({ notes: new Map([['topic-b', 'note for b']]) });
    const { rerender } = render(<TopicNotes topicId="topic-a" />);
    expect(screen.getByLabelText('ההערות שלי')).toHaveValue('');

    rerender(<TopicNotes topicId="topic-b" />);
    expect(screen.getByLabelText('ההערות שלי')).toHaveValue('note for b');
  });
});
```

Note: `vi` is a global in this repo's Vitest config (see any existing test file using `vi.` without importing it, e.g. `SearchBar.test.tsx`) — if your environment requires an explicit import, add `vi` to the `vitest` import on line 1: `import { beforeEach, describe, expect, it, vi } from 'vitest';`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- TopicNotes.test.tsx`
Expected: FAIL — `./TopicNotes` does not exist.

- [ ] **Step 3: Implement `TopicNotes.tsx`**

Create `kb-app/src/components/topic/TopicNotes.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useUserDataStore } from '../../store/userDataStore';

interface TopicNotesProps {
  topicId: string;
}

const SAVE_DEBOUNCE_MS = 500;

export default function TopicNotes({ topicId }: TopicNotesProps) {
  const storedText = useUserDataStore((s) => s.notes.get(topicId) ?? '');
  const setNote = useUserDataStore((s) => s.setNote);
  const [value, setValue] = useState(storedText);
  const timeoutRef = useRef<number | null>(null);

  // TopicReader is reused across /topic/:id navigations (no `key` prop in
  // Reader.tsx), so this component is never remounted when the topic
  // changes — resync local state from the new topic's stored note instead
  // of carrying over the previous topic's draft.
  useEffect(() => {
    setValue(storedText);
    // Deliberately only re-syncing on topicId change, not on every
    // storedText change, so this effect doesn't clobber an in-progress
    // edit the moment the store's optimistic update lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function scheduleSave(text: string) {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setNote(topicId, text);
    }, SAVE_DEBOUNCE_MS);
  }

  function flush(text: string) {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setNote(topicId, text);
  }

  return (
    <div className="mt-8 border-t border-[var(--kb-border)] pt-4">
      <label htmlFor={`topic-notes-${topicId}`} className="mb-2 block text-sm font-bold text-[var(--kb-text)]">
        ההערות שלי
      </label>
      <textarea
        id={`topic-notes-${topicId}`}
        value={value}
        onChange={(event) => {
          const text = event.target.value;
          setValue(text);
          scheduleSave(text);
        }}
        onBlur={(event) => flush(event.target.value)}
        placeholder="כתוב כאן הערות אישיות על הנושא…"
        rows={4}
        className="w-full rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface)] p-3 text-[var(--kb-text)] outline-none placeholder:text-[var(--kb-muted)]"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- TopicNotes.test.tsx`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd kb-app
git add src/components/topic/TopicNotes.tsx src/components/topic/TopicNotes.test.tsx
git commit -m "feat: add TopicNotes component with debounced autosave"
```

---

## Task 4: `TopicReader` integration

**Files:**
- Modify: `kb-app/src/components/reader/TopicReader.tsx`
- Test: `kb-app/src/components/reader/TopicReader.test.tsx`

**Interfaces:**
- Consumes: `TopicNotes({ topicId: string })` default export (Task 3).

- [ ] **Step 1: Write the failing test**

In `kb-app/src/components/reader/TopicReader.test.tsx`, update the `beforeEach` to include `notes` in the store reset (required — `TopicNotes` reads `s.notes.get(topicId)`, which throws if `notes` is not a `Map`):

```tsx
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve('<p>תוכן הנושא המלא</p>'),
  }) as unknown as typeof fetch;
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], notes: new Map(), isLoaded: true });
});
```

Add a new test (anywhere after the existing `'renders status and favorite controls for the topic'` test):

```tsx
  it('renders the personal notes textarea for the topic', () => {
    renderWithRouter();
    expect(screen.getByLabelText('ההערות שלי')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kb-app && npm run test -- TopicReader.test.tsx`
Expected: FAIL — no element with label "ההערות שלי".

- [ ] **Step 3: Wire `TopicNotes` into `TopicReader`**

In `kb-app/src/components/reader/TopicReader.tsx`, add the import:

```tsx
import TopicNotes from '../topic/TopicNotes';
```

Render it after the content block, before `<RelatedTopics>`:

```tsx
      {html === null ? (
        error ? (
          <p role="alert">שגיאה בטעינת התוכן.</p>
        ) : (
          <p role="status">טוען תוכן…</p>
        )
      ) : (
        <div className="kb-topic-content" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <TopicNotes topicId={topic.id} />
      <RelatedTopics relatedIds={topic.related_match} topicsById={topicsById} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- TopicReader.test.tsx`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd kb-app
git add src/components/reader/TopicReader.tsx src/components/reader/TopicReader.test.tsx
git commit -m "feat: render TopicNotes in TopicReader"
```

---

## Task 5: Search integration — `uiStore` toggle + `filterTopics` + `Home` wiring

**Files:**
- Modify: `kb-app/src/store/uiStore.ts`
- Modify: `kb-app/src/lib/filterTopics.ts`
- Modify: `kb-app/src/pages/Home.tsx`
- Test: `kb-app/src/store/uiStore.test.ts`
- Test: `kb-app/src/lib/filterTopics.test.ts`
- Test: `kb-app/src/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `TopicNotes`/`notes` state from Tasks 2-4 (via `userDataStore`).
- Produces: `uiStore.includeNotesInSearch: boolean`, `uiStore.toggleIncludeNotesInSearch: () => void`; `filterTopics(topics, searchIndex, filters, progress, notes?: Map<string, string>): Topic[]`.

This is the final task for this sub-project — Step 8 below is the full-suite verification gate.

- [ ] **Step 1: Write the failing `uiStore` tests**

In `kb-app/src/store/uiStore.test.ts`, update the `reset()` helper:

```ts
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
    includeNotesInSearch: false,
  });
}
```

Add a new test after `'toggleStatus adds then removes a status'`:

```ts
  it('toggleIncludeNotesInSearch flips the flag', () => {
    expect(useUiStore.getState().includeNotesInSearch).toBe(false);
    useUiStore.getState().toggleIncludeNotesInSearch();
    expect(useUiStore.getState().includeNotesInSearch).toBe(true);
    useUiStore.getState().toggleIncludeNotesInSearch();
    expect(useUiStore.getState().includeNotesInSearch).toBe(false);
  });
```

Update the `'clearFilters resets query, modules, categories and statuses but not sort/view'` test to also cover the new flag:

```ts
  it('clearFilters resets query, modules, categories, statuses and includeNotesInSearch but not sort/view', () => {
    const store = useUiStore.getState();
    store.setSearchQuery('x');
    store.toggleModule('Intro to Data Science');
    store.toggleCategory('algorithms');
    store.toggleStatus('mastered');
    store.toggleIncludeNotesInSearch();
    store.setSortOrder('alpha');
    store.clearFilters();

    const state = useUiStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.selectedModules.size).toBe(0);
    expect(state.selectedCategories.size).toBe(0);
    expect(state.selectedStatuses.size).toBe(0);
    expect(state.includeNotesInSearch).toBe(false);
    expect(state.sortOrder).toBe('alpha'); // untouched
  });
```

- [ ] **Step 2: Write the failing `filterTopics` tests**

In `kb-app/src/lib/filterTopics.test.ts`, add a new `describe` block at the end of the file, before the closing of the top-level `describe('filterTopics', ...)` — i.e. as the last block of tests inside it:

```ts
  describe('notes-in-search', () => {
    it('does not consider notes when the notes param is omitted', () => {
      const result = filterTopics(topics, searchIndex, filters({ searchQuery: 'unique-note-term' }), noProgress);
      expect(result).toEqual([]);
    });

    it('matches a topic whose note text contains the query, even if the topic text does not', () => {
      const notes = new Map([['c', 'this has unique-note-term inside']]);
      const result = filterTopics(
        topics,
        searchIndex,
        filters({ searchQuery: 'unique-note-term' }),
        noProgress,
        notes,
      );
      expect(result.map((t) => t.id)).toEqual(['c']);
    });

    it('does not duplicate a topic matched by both the static index and its note', () => {
      const notes = new Map([['a', 'linear regression is great']]);
      const result = filterTopics(
        topics,
        searchIndex,
        filters({ searchQuery: 'linear' }),
        noProgress,
        notes,
      );
      expect(result.map((t) => t.id)).toEqual(['a']);
    });

    it('ignores notes entirely when there is no search query', () => {
      const notes = new Map([['c', 'anything']]);
      const result = filterTopics(topics, searchIndex, filters({}), noProgress, notes);
      expect(result.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
    });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- uiStore.test.ts filterTopics.test.ts`
Expected: FAIL — `includeNotesInSearch`/`toggleIncludeNotesInSearch` don't exist on `uiStore`; `filterTopics` ignores its 5th argument (notes-matching tests fail because notes aren't considered yet).

- [ ] **Step 4: Implement the `uiStore` toggle**

In `kb-app/src/store/uiStore.ts`, update the `UiState` interface:

```ts
interface UiState {
  searchQuery: string;
  selectedModules: Set<string>;
  selectedCategories: Set<string>;
  selectedStatuses: Set<ProgressStatus>;
  sortOrder: SortOrder;
  viewMode: ViewMode;
  sidebarCollapsed: boolean;
  expandedGroups: Set<string>;
  includeNotesInSearch: boolean;

  setSearchQuery: (query: string) => void;
  toggleModule: (moduleKey: string) => void;
  toggleCategory: (category: string) => void;
  toggleStatus: (status: ProgressStatus) => void;
  toggleIncludeNotesInSearch: () => void;
  clearFilters: () => void;
  setSortOrder: (order: SortOrder) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebarCollapsed: () => void;
  toggleGroup: (moduleKey: string) => void;
  expandAllGroups: () => void;
  collapseAllGroups: () => void;
}
```

Update the store body:

```ts
export const useUiStore = create<UiState>()((set) => ({
  searchQuery: '',
  selectedModules: new Set(),
  selectedCategories: new Set(),
  selectedStatuses: new Set(),
  sortOrder: 'original',
  viewMode: 'grid',
  sidebarCollapsed: false,
  expandedGroups: new Set(allModuleKeys),
  includeNotesInSearch: false,

  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleModule: (moduleKey) =>
    set((state) => ({ selectedModules: toggleInSet(state.selectedModules, moduleKey) })),
  toggleCategory: (category) =>
    set((state) => ({ selectedCategories: toggleInSet(state.selectedCategories, category) })),
  toggleStatus: (status) =>
    set((state) => ({ selectedStatuses: toggleInSet(state.selectedStatuses, status) })),
  toggleIncludeNotesInSearch: () =>
    set((state) => ({ includeNotesInSearch: !state.includeNotesInSearch })),
  clearFilters: () =>
    set({
      searchQuery: '',
      selectedModules: new Set(),
      selectedCategories: new Set(),
      selectedStatuses: new Set(),
      includeNotesInSearch: false,
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

- [ ] **Step 5: Implement `filterTopics`'s notes parameter**

In `kb-app/src/lib/filterTopics.ts`, update the function signature and the search-matching block:

```ts
export function filterTopics(
  topics: Topic[],
  searchIndex: SearchEntry[],
  filters: FilterState,
  progress: Map<string, ProgressStatus>,
  notes?: Map<string, string>,
): Topic[] {
  const normalizedQuery = normalize(filters.searchQuery);
  const matchedIds = normalizedQuery
    ? new Set(
        searchIndex.filter((entry) => entry.search.includes(normalizedQuery)).map((entry) => entry.id),
      )
    : null;

  if (matchedIds && notes) {
    for (const [topicId, text] of notes) {
      if (normalize(text).includes(normalizedQuery)) {
        matchedIds.add(topicId);
      }
    }
  }

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
```

(`sortTopics` is unchanged.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- uiStore.test.ts filterTopics.test.ts`
Expected: PASS, all tests in both files.

- [ ] **Step 7: Wire `Home.tsx` — checkbox toggle + notes pass-through**

In `kb-app/src/pages/Home.tsx`, add these two `useUiStore`/`useUserDataStore` reads alongside the existing ones (after `const toggleStatus = useUiStore((s) => s.toggleStatus);` and after `const progress = useUserDataStore((s) => s.progress);` respectively):

```tsx
  const includeNotesInSearch = useUiStore((s) => s.includeNotesInSearch);
  const toggleIncludeNotesInSearch = useUiStore((s) => s.toggleIncludeNotesInSearch);
  const notes = useUserDataStore((s) => s.notes);
```

Update the `filtered` `useMemo`:

```tsx
  const filtered = useMemo(
    () =>
      filterTopics(
        topics,
        searchIndex,
        { searchQuery, selectedModules, selectedCategories, selectedStatuses, sortOrder },
        progress,
        includeNotesInSearch ? notes : undefined,
      ),
    [
      searchQuery,
      selectedModules,
      selectedCategories,
      selectedStatuses,
      sortOrder,
      progress,
      includeNotesInSearch,
      notes,
    ],
  );
```

Add the checkbox in the search row, immediately after `<SearchBar />`:

```tsx
            <SearchBar />
            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--kb-text)]">
              <input type="checkbox" checked={includeNotesInSearch} onChange={toggleIncludeNotesInSearch} />
              כלול הערות בחיפוש
            </label>
```

- [ ] **Step 8: Write and run the `Home.tsx` tests, verify full suite**

In `kb-app/src/pages/Home.test.tsx`, update the `reset()` helper:

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
    includeNotesInSearch: false,
  });
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], notes: new Map(), isLoaded: true });
}
```

Add two new tests at the end of the `describe('Home', ...)` block:

```tsx
  it('toggles includeNotesInSearch when the "include notes" checkbox is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'כלול הערות בחיפוש' });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(useUiStore.getState().includeNotesInSearch).toBe(true);
  });

  it('finds a topic by its note text only when "include notes in search" is toggled on', () => {
    useUserDataStore.setState({ notes: new Map([[topicsData[2].id, 'zzz-unique-note-term']]) });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    act(() => {
      useUiStore.getState().setSearchQuery('zzz-unique-note-term');
    });
    expect(screen.queryAllByRole('link')).toHaveLength(0);

    act(() => {
      useUiStore.getState().toggleIncludeNotesInSearch();
    });
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
```

Run the full verification suite for this sub-project:

```bash
cd kb-app
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: everything green.

- [ ] **Step 9: Commit**

```bash
cd kb-app
git add src/store/uiStore.ts src/store/uiStore.test.ts src/lib/filterTopics.ts src/lib/filterTopics.test.ts src/pages/Home.tsx src/pages/Home.test.tsx
git commit -m "feat: search integration for personal notes (uiStore toggle + filterTopics + Home)"
```

---

## Critical files
- `kb-app/src/lib/db.ts`
- `kb-app/src/store/userDataStore.ts`
- `kb-app/src/components/topic/TopicNotes.tsx`
- `kb-app/src/components/reader/TopicReader.tsx`
- `kb-app/src/lib/filterTopics.ts`
- `kb-app/src/pages/Home.tsx`

## Verification (end-to-end, after Task 5)
1. `npm run typecheck && npm run lint && npm run test && npm run build` all green.
2. `npm run dev` — manually confirm: typing in a topic's notes textarea autosaves silently after a short pause; reloading the page preserves the note; clearing a note back to empty and reloading shows an empty textarea (no orphaned row); toggling "כלול הערות בחיפוש" on finds a topic by note text alone, and off excludes it again; existing module/category/status filters still combine correctly with search.
3. Repeat in dark theme and RTL (already default) — no regressions to existing reader/search/filter behavior.
4. Test in a private/incognito window (or simulate an IndexedDB failure) to confirm notes silently no-op rather than crash.

## Repo convention note
This repo tracks implementation via `.superpowers/sdd/<plan-name>/progress.md` (one task = one commit, reviewed before moving on) and task briefs under the same directory. Once this plan is approved, follow that existing convention for execution.
