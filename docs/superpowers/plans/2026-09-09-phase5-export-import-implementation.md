# Phase 5, Sub-project #1 — Export/Import JSON Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user download all of their local IndexedDB data (progress, favorites, recents, notes, SRS cards) as one JSON file from a new Settings page, and restore it later via full overwrite — no Supabase, no network, no account required.

**Architecture:** Two new `lib/db.ts` functions (`exportAllData`/`importAllData`) reuse the file's existing per-table `getAll*` reads and add one multi-store `readwrite` transaction for import. A new lazily-loaded `Settings` page at `/settings` drives both, with structural validation and a native `confirm()` guard before any destructive import. `Header` and the command palette each get one new nav entry.

**Tech Stack:** React 19, TypeScript, `idb` (IndexedDB wrapper, already in use), Zustand, Vitest + Testing Library, `fake-indexeddb`.

**Spec:** `docs/superpowers/specs/2026-09-09-phase5-export-import-design.md`

## Global Constraints

- Export payload shape is fixed: `{ version: 1, exportedAt: <ISO string>, data: { progress, favorites, recents, notes, srsCards } }` — five tables, `recents` included even though the backend doc's Supabase schema omits it (local-only, no sync counterpart).
- Import is a **full overwrite**, never a merge — confirmed via `window.confirm()` before any IndexedDB write, and rejected entirely (no confirm, no write) if the file fails structural validation.
- `/settings` is lazy-loaded (`React.lazy()`) inside `App.tsx`'s existing shared `<Suspense>`/`RouteErrorBoundary` — no new boundary.
- No hardcoded colors — only `--kb-*` tokens. Every interactive element ≥44px tall (`min-h-11`, matching existing Header links/buttons) with visible `focus-visible`.
- RTL and both themes must work on the new page (golden rules 5–7, `kb-app/CLAUDE.md`).
- No Supabase, `.env`, or network code in this sub-project — pure IndexedDB ↔ local file.

---

## Task 1: `exportAllData`/`importAllData` in `lib/db.ts`

**Files:**
- Modify: `kb-app/src/lib/db.ts`
- Modify: `kb-app/src/lib/db.test.ts`

**Interfaces:**
- Produces: `ExportPayload` type; `exportAllData(): Promise<ExportPayload>`; `importAllData(data: ExportPayload['data']): Promise<void>` — both exported from `lib/db.ts`, consumed by the `Settings` page in Task 2.

- [ ] **Step 1: Write the failing tests**

Append to `kb-app/src/lib/db.test.ts`, after the `describe('db — v2 to v3 migration', ...)` block and before `describe('db — failure handling', ...)`:

```ts
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
    ).resolves.toBeUndefined();

    indexedDB.open = originalOpen;
    warnSpy.mockRestore();
  });
});
```

Add `exportAllData` and `importAllData` to the existing `import { ... } from './db'` block at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd kb-app && npm run test -- db.test.ts`
Expected: FAIL — `exportAllData`/`importAllData` are not exported from `./db` yet (import error / undefined is not a function).

- [ ] **Step 3: Implement `exportAllData`/`importAllData` in `lib/db.ts`**

Add near the top of `kb-app/src/lib/db.ts`, after the existing imports:

```ts
export interface ExportPayload {
  version: 1;
  exportedAt: string;
  data: {
    progress: Progress[];
    favorites: Favorite[];
    recents: Recent[];
    notes: Note[];
    srsCards: SrsCard[];
  };
}
```

Add at the end of the file, before `__resetDbForTests`:

```ts
export async function exportAllData(): Promise<ExportPayload> {
  const [progress, favorites, recents, notes, srsCards] = await Promise.all([
    getAllProgress(),
    getAllFavorites(),
    getAllRecents(),
    getAllNotes(),
    getAllSrsCards(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { progress, favorites, recents, notes, srsCards },
  };
}

/** One readwrite transaction across all five stores: every store is cleared
 *  first, then every imported row is put — clear() and put() calls on the
 *  same store are issued synchronously in that order below, so IndexedDB's
 *  same-store FIFO request ordering guarantees clear-before-write even
 *  though nothing here is individually awaited until the final Promise.all.
 *  A single transaction means a mid-import failure can't leave some stores
 *  overwritten and others stale. */
export async function importAllData(data: ExportPayload['data']): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(['progress', 'favorites', 'recents', 'notes', 'srsCards'], 'readwrite');
    await Promise.all([
      tx.objectStore('progress').clear(),
      tx.objectStore('favorites').clear(),
      tx.objectStore('recents').clear(),
      tx.objectStore('notes').clear(),
      tx.objectStore('srsCards').clear(),
      ...data.progress.map((row) => tx.objectStore('progress').put(row)),
      ...data.favorites.map((row) => tx.objectStore('favorites').put(row)),
      ...data.recents.map((row) => tx.objectStore('recents').put(row)),
      ...data.notes.map((row) => tx.objectStore('notes').put(row)),
      ...data.srsCards.map((row) => tx.objectStore('srsCards').put(row)),
      tx.done,
    ]);
  } catch (error) {
    warnOnce('importAllData', error);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd kb-app && npm run test -- db.test.ts`
Expected: PASS (all tests in the file, including the five new ones).

- [ ] **Step 5: Run full verification**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: both green.

- [ ] **Step 6: Commit**

```bash
git add kb-app/src/lib/db.ts kb-app/src/lib/db.test.ts
git commit -m "feat: add exportAllData/importAllData to lib/db.ts"
```

---

## Task 2: `Settings` page

**Files:**
- Create: `kb-app/src/pages/Settings.tsx`
- Create: `kb-app/src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `exportAllData`, `importAllData`, `type ExportPayload` from `../lib/db` (Task 1); `useUserDataStore` from `../store/userDataStore` (existing, `loadUserData()` action already used the same way in `App.tsx`); `Header` from `../components/layout/Header` (existing).
- Produces: `Settings` — default export, a full page component (renders its own `<Header />` + `<main>`, matching every other page in `src/pages/`). Consumed by `App.tsx` in Task 3.

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/pages/Settings.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { IDBFactory } from 'fake-indexeddb';
import Settings from './Settings';
import { useUserDataStore } from '../store/userDataStore';
import { __resetDbForTests, setProgress } from '../lib/db';

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
}

function validBackupFile(progress: unknown[] = [{ topicId: 'topic-a', status: 'mastered', updatedAt: 1 }]) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { progress, favorites: [], recents: [], notes: [], srsCards: [] },
  };
  return new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
}

beforeEach(() => {
  // eslint-disable-next-line no-global-assign
  indexedDB = new IDBFactory();
  __resetDbForTests();
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

describe('Settings — export', () => {
  it('renders an export button', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: 'ייצא את הנתונים שלי' })).toBeInTheDocument();
  });

  it('clicking export creates a blob URL from the current data', async () => {
    const user = userEvent.setup();
    await setProgress('topic-a', 'learning');
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'ייצא את הנתונים שלי' }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    const [blobArg] = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(blobArg).toBeInstanceOf(Blob);
    const text = await (blobArg as Blob).text();
    expect(JSON.parse(text).data.progress).toEqual([{ topicId: 'topic-a', status: 'learning', updatedAt: expect.any(Number) }]);
  });

  it('names the downloaded file with today\'s local date', async () => {
    const user = userEvent.setup();
    const realCreateElement = document.createElement.bind(document);
    let anchor: HTMLAnchorElement | undefined;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === 'a') anchor = el as HTMLAnchorElement;
      return el;
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderSettings();
    await user.click(screen.getByRole('button', { name: 'ייצא את הנתונים שלי' }));

    await waitFor(() => expect(anchor).toBeDefined());
    const today = new Date();
    const expectedName = `kb-backup-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.json`;
    expect(anchor?.download).toBe(expectedName);

    vi.restoreAllMocks();
  });
});

describe('Settings — import', () => {
  it('renders an import button and a hidden file input', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: 'ייבוא נתונים' })).toBeInTheDocument();
    expect(screen.getByLabelText('בחר קובץ גיבוי לייבוא')).toBeInTheDocument();
  });

  it('imports a valid file after confirmation, refreshes the store, and shows a success message', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSettings();

    await user.upload(screen.getByLabelText('בחר קובץ גיבוי לייבוא'), validBackupFile());

    expect(await screen.findByRole('status')).toHaveTextContent('הנתונים יובאו בהצלחה');
    await waitFor(() => expect(useUserDataStore.getState().progress.get('topic-a')).toBe('mastered'));
  });

  it('does nothing when the user cancels the confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderSettings();

    await user.upload(screen.getByLabelText('בחר קובץ גיבוי לייבוא'), validBackupFile());

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(useUserDataStore.getState().progress.size).toBe(0);
  });

  it('shows an error and never prompts for confirmation when the file is not valid JSON', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderSettings();

    await user.upload(
      screen.getByLabelText('בחר קובץ גיבוי לייבוא'),
      new File(['not json'], 'bad.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('קובץ לא תקין');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('shows an error when the JSON is well-formed but structurally invalid', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderSettings();

    await user.upload(
      screen.getByLabelText('בחר קובץ גיבוי לייבוא'),
      new File([JSON.stringify({ version: 1, data: { progress: [] } })], 'bad.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('קובץ לא תקין');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('rejects a progress row with an invalid status value', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderSettings();

    await user.upload(
      screen.getByLabelText('בחר קובץ גיבוי לייבוא'),
      validBackupFile([{ topicId: 'topic-a', status: 'bogus', updatedAt: 1 }]),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('קובץ לא תקין');
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd kb-app && npm run test -- Settings.test.tsx`
Expected: FAIL — `./Settings` doesn't exist yet.

- [ ] **Step 3: Implement `Settings.tsx`**

Create `kb-app/src/pages/Settings.tsx`:

```tsx
import { useRef, useState, type ChangeEvent } from 'react';
import Header from '../components/layout/Header';
import { exportAllData, importAllData, type ExportPayload } from '../lib/db';
import { useUserDataStore } from '../store/userDataStore';

const VALID_PROGRESS_STATUSES = new Set(['new', 'learning', 'mastered']);

function isValidExportPayload(value: unknown): value is ExportPayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  if (payload.version !== 1) return false;
  if (typeof payload.data !== 'object' || payload.data === null) return false;
  const data = payload.data as Record<string, unknown>;

  const { progress, favorites, recents, notes, srsCards } = data;
  if (![progress, favorites, recents, notes, srsCards].every(Array.isArray)) return false;

  const progressRows = progress as unknown[];
  const favoriteRows = favorites as unknown[];
  const recentRows = recents as unknown[];
  const noteRows = notes as unknown[];
  const srsRows = srsCards as unknown[];

  const hasTopicId = (row: unknown): row is Record<string, unknown> =>
    typeof row === 'object' && row !== null && typeof (row as Record<string, unknown>).topicId === 'string';

  return (
    progressRows.every((row) => hasTopicId(row) && VALID_PROGRESS_STATUSES.has(row.status as string)) &&
    favoriteRows.every((row) => hasTopicId(row) && typeof row.createdAt === 'number') &&
    recentRows.every((row) => hasTopicId(row) && typeof row.viewedAt === 'number') &&
    noteRows.every((row) => hasTopicId(row) && typeof row.text === 'string') &&
    srsRows.every((row) => hasTopicId(row) && typeof row.ease === 'number')
  );
}

function backupFileName(exportedAt: string): string {
  // Local calendar date (getFullYear/getMonth/getDate, not the UTC
  // getters) — exportedAt is an ISO/UTC timestamp, but the filename should
  // read as "today" to whoever is looking at their own downloads folder.
  const date = new Date(exportedAt);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `kb-backup-${yyyy}-${mm}-${dd}.json`;
}

export default function Settings() {
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    const payload = await exportAllData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backupFileName(payload.exportedAt);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so re-selecting the same filename after a rejected import still
    // fires onChange.
    event.target.value = '';
    if (!file) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setMessage({ kind: 'error', text: 'קובץ לא תקין.' });
      return;
    }

    if (!isValidExportPayload(parsed)) {
      setMessage({ kind: 'error', text: 'קובץ לא תקין.' });
      return;
    }

    const confirmed = window.confirm('הפעולה תחליף את כל הנתונים המקומיים הקיימים. להמשיך?');
    if (!confirmed) return;

    await importAllData(parsed.data);
    await useUserDataStore.getState().loadUserData();
    setMessage({ kind: 'success', text: 'הנתונים יובאו בהצלחה.' });
  }

  return (
    <>
      <Header />
      <main className="flex flex-col gap-8 p-4">
        <h1 className="text-xl font-bold text-[var(--kb-text)]">הגדרות</h1>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-[var(--kb-text)]">ייצוא נתונים</h2>
          <p className="text-sm text-[var(--kb-muted)]">
            שמור קובץ גיבוי של כל הנתונים האישיים שלך — התקדמות, מועדפים, הערות וכרטיסיות.
          </p>
          <button
            type="button"
            onClick={handleExport}
            className="min-h-11 w-fit rounded-md border border-[var(--kb-border)] px-4 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
          >
            ייצא את הנתונים שלי
          </button>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-[var(--kb-text)]">ייבוא נתונים</h2>
          <p className="text-sm text-[var(--kb-muted)]">
            שחזר נתונים מקובץ גיבוי. הפעולה תחליף את כל הנתונים המקומיים הקיימים.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileSelected}
            aria-label="בחר קובץ גיבוי לייבוא"
            className="sr-only"
          />
          <button
            type="button"
            onClick={handleImportClick}
            className="min-h-11 w-fit rounded-md border border-[var(--kb-border)] px-4 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
          >
            ייבוא נתונים
          </button>
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className="text-sm text-[var(--kb-text)]">
              {message.text}
            </p>
          )}
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd kb-app && npm run test -- Settings.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 5: Run full verification**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: both green.

- [ ] **Step 6: Commit**

```bash
git add kb-app/src/pages/Settings.tsx kb-app/src/pages/Settings.test.tsx
git commit -m "feat: add Settings page with export/import backup"
```

---

## Task 3: Wire `/settings` into `App.tsx`

**Files:**
- Modify: `kb-app/src/App.tsx`
- Modify: `kb-app/src/App.test.tsx`

**Interfaces:**
- Consumes: `Settings` default export from `./pages/Settings` (Task 2).

- [ ] **Step 1: Write the failing test**

In `kb-app/src/App.test.tsx`, add after the `'renders the Map page at "/map"'` test:

```tsx
  it('renders the Settings page at "/settings"', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'הגדרות' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd kb-app && npm run test -- App.test.tsx`
Expected: FAIL — no `/settings` route exists yet, so nothing ever renders the "הגדרות" heading (`findByRole` eventually times out).

- [ ] **Step 3: Add the lazy route in `App.tsx`**

In `kb-app/src/App.tsx`, add to the lazy imports (after `const KnowledgeMap = lazy(() => import('./pages/Map'));`):

```tsx
const Settings = lazy(() => import('./pages/Settings'));
```

Add a new `<Route>` inside `<Routes>`, after the `/map` route:

```tsx
            <Route path="/settings" element={<Settings />} />
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd kb-app && npm run test -- App.test.tsx`
Expected: PASS (all tests, including the new one).

- [ ] **Step 5: Run full verification and check the build**

Run: `cd kb-app && npm run test && npm run typecheck && npm run lint && npm run build`
Expected: all four green; the build output lists a new `Settings-*.js` chunk alongside the existing `Flashcards`/`Quiz`/`Map` chunks.

- [ ] **Step 6: Commit**

```bash
git add kb-app/src/App.tsx kb-app/src/App.test.tsx
git commit -m "feat: route /settings to the lazy-loaded Settings page"
```

---

## Task 4: Navigation entries (`Header` + Command Palette)

**Files:**
- Modify: `kb-app/src/components/layout/Header.tsx`
- Modify: `kb-app/src/components/layout/Header.test.tsx`
- Modify: `kb-app/src/lib/commandPalette.ts`
- Modify: `kb-app/src/lib/commandPalette.test.ts`
- Modify: `kb-app/src/components/palette/CommandPalette.tsx`
- Modify: `kb-app/src/components/palette/CommandPalette.test.tsx`

**Interfaces:**
- None new — this task only adds one more entry to each of two existing lists/route maps.

- [ ] **Step 1: Write the failing tests**

In `kb-app/src/components/layout/Header.test.tsx`, add after the `'renders a link to the Map page'` test:

```tsx
  it('renders a link to the Settings page', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: 'הגדרות' })).toHaveAttribute('href', '/settings');
  });
```

In `kb-app/src/lib/commandPalette.test.ts`, change the `buildActionList` assertion:

```ts
    expect(actions.map((a) => a.id).sort()).toEqual(['flashcards', 'home', 'map', 'quiz', 'settings', 'toggle-theme']);
```

In `kb-app/src/components/palette/CommandPalette.test.tsx`, change the `'shows all five actions...'` test's title and body to six actions:

```tsx
  it('shows all six actions and no topics when opened with an empty query', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('option', { name: 'כרטיסיות' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'מבחן' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'מפת ידע' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'הגדרות' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'החלף ערכת נושא' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(6);
  });
```

Add a new test after `'selecting a page action navigates and closes the palette'`:

```tsx
  it('selecting "settings" navigates to /settings and closes the palette', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    await user.click(screen.getByRole('option', { name: 'הגדרות' }));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd kb-app && npm run test -- Header.test.tsx commandPalette.test.ts CommandPalette.test.tsx`
Expected: FAIL — no Settings link in `Header`, `buildActionList()` still returns five actions, palette still shows five options and has no route for `settings`.

- [ ] **Step 3: Add the Header link**

In `kb-app/src/components/layout/Header.tsx`, add a new `<Link>` after the `/map` link and before the `canInstall` block:

```tsx
        <Link
          to="/settings"
          className="flex min-h-11 items-center rounded-md px-3 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
        >
          הגדרות
        </Link>
```

- [ ] **Step 4: Add the command palette action + route**

In `kb-app/src/lib/commandPalette.ts`, add to `buildActionList()`'s returned array, after `{ id: 'map', label: 'מפת ידע' }`:

```ts
    { id: 'settings', label: 'הגדרות' },
```

In `kb-app/src/components/palette/CommandPalette.tsx`, add to `ACTION_ROUTES`:

```ts
  settings: '/settings',
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd kb-app && npm run test -- Header.test.tsx commandPalette.test.ts CommandPalette.test.tsx`
Expected: PASS (all tests in all three files).

- [ ] **Step 6: Run full verification**

Run: `cd kb-app && npm run test && npm run typecheck && npm run lint && npm run build`
Expected: all four green, same total test count plus the tests added across Tasks 1–4.

- [ ] **Step 7: Commit**

```bash
git add kb-app/src/components/layout/Header.tsx kb-app/src/components/layout/Header.test.tsx \
        kb-app/src/lib/commandPalette.ts kb-app/src/lib/commandPalette.test.ts \
        kb-app/src/components/palette/CommandPalette.tsx kb-app/src/components/palette/CommandPalette.test.tsx
git commit -m "feat: add Settings nav entry to Header and command palette"
```

---

## Manual QA (post-implementation, not testable in jsdom)

- `npm run build && npm run preview`: open `/settings` directly, confirm the `RouteFallback` "טוען…" flashes briefly then the page renders (fresh Suspense boundary, same as Flashcards/Quiz/Map).
- Click "ייצא את הנתונים שלי" with some real progress/notes/SRS data set — confirm a `kb-backup-YYYY-MM-DD.json` file downloads, open it in a text editor, confirm the JSON shape and that the data matches what's in the app.
- Clear site data in DevTools (Application → Clear storage), reload — confirm the app starts empty. Go to `/settings`, import the previously-downloaded file, confirm the browser's native confirm dialog appears, confirm it — verify progress/favorites/notes/SRS are all restored across Home, Flashcards, and the Reader's per-topic status.
- Attempt importing a non-JSON file (e.g. a `.png` renamed to `.json`) and an unrelated valid-JSON file (e.g. `package.json`) — confirm both are rejected with the "קובץ לא תקין" message and no data changes.
- Click the import button, then dismiss the native confirm dialog — confirm no message appears and no data changes.
- Light theme, dark theme, RTL check on the Settings page, its two buttons, and both nav entries (Header link, command palette option).
- Keyboard-only pass: reach the Settings page via Tab from the Header, trigger export and import (including the hidden file input) without a mouse, confirm visible focus rings throughout.
- Confirm no regression to any Phase 3/4 feature (Flashcards SRS grading, Quiz, Map, offline caching, install prompt) or to the existing Header/command-palette entries.
