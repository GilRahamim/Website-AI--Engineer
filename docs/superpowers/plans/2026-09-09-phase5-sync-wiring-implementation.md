# Phase 5, Sub-project #3c — Sync Wiring + Auto-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the already-built `lib/sync.ts` engine into the running app: a new `syncStore.ts` orchestrates when sync runs, `userDataStore.ts`'s writes trigger a debounced push, `App.tsx` starts it, and `Settings.tsx` shows a status line + manual button.

**Architecture:** One new Zustand store (`syncStore.ts`) subscribes to `authStore`'s `email` to start/stop a 60s pull interval plus `focus`/`online` listeners, and exposes a debounced `scheduleDirtyPush()` for `userDataStore` to call after each syncable write. No changes to `lib/sync.ts`'s three exported functions.

**Tech Stack:** Zustand (already a dependency), Vitest fake timers for interval/debounce tests.

**Spec:** `docs/superpowers/specs/2026-09-09-phase5-sync-wiring-design.md`

## Global Constraints

- New file `kb-app/src/store/syncStore.ts` exports `useSyncStore` with state `{ status: 'idle' | 'synced', lastSyncedAt: number | null }` and actions `start()`, `scheduleDirtyPush()`, `syncNow()`.
- `start()` is idempotence-guarded the same way `authStore.init()` already is (a module-level boolean) — safe against React 19 StrictMode's double-invoked mount effect.
- Debounce for `scheduleDirtyPush()`: `DIRTY_PUSH_DEBOUNCE_MS = 3000`. Pull interval: `PULL_INTERVAL_MS = 60_000`.
- `userDataStore.ts`'s `setStatus`, `toggleFavorite`, `setNote`, `gradeCard` each call `useSyncStore.getState().scheduleDirtyPush()` after their existing persistence call. `recordView` does NOT (`recents` never syncs).
- `App.tsx` starts `syncStore` via a chained dynamic import after `authStore`'s, matching the existing pattern.
- `Settings.tsx`'s signed-in Account section gets a last-synced status line + manual sync button; the signed-out helper text drops "(בקרוב)".
- No changes to `kb-app/src/lib/sync.ts`, `kb-app/src/lib/db.ts`, or `kb-app/supabase/schema.sql`.
- After every task: `npm run typecheck && npm run lint && npm run test && npm run build` (from `kb-app/`) must be green.

---

### Task 1: `syncStore.ts`

**Files:**
- Create: `kb-app/src/store/syncStore.ts`
- Test: `kb-app/src/store/syncStore.test.ts`

**Interfaces:**
- Consumes: `useAuthStore` (`./authStore`, pre-existing — reads `.getState().email`, subscribes via `.subscribe((state, prevState) => ...)`); `fullSync`, `pushDirty`, `pullSince` from `../lib/sync` (pre-existing, unchanged).
- Produces (for Task 2/3 to consume): `useSyncStore` with `status`, `lastSyncedAt`, `start()`, `scheduleDirtyPush()`, `syncNow(): Promise<void>`. Also `__resetSyncStoreForTests()`, test-only, matching `authStore`'s `__resetAuthStoreForTests` convention.

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/store/syncStore.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './authStore';

vi.mock('../lib/sync', () => ({
  fullSync: vi.fn(() => Promise.resolve()),
  pushDirty: vi.fn(() => Promise.resolve()),
  pullSince: vi.fn(() => Promise.resolve()),
}));

const { fullSync, pushDirty, pullSince } = await import('../lib/sync');
const { useSyncStore, __resetSyncStoreForTests } = await import('./syncStore');

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(fullSync).mockClear().mockResolvedValue(undefined);
  vi.mocked(pushDirty).mockClear().mockResolvedValue(undefined);
  vi.mocked(pullSince).mockClear().mockResolvedValue(undefined);
  useAuthStore.setState({ email: null, status: 'idle', errorMessage: null });
  useSyncStore.setState({ status: 'idle', lastSyncedAt: null });
  __resetSyncStoreForTests();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('syncStore — start()', () => {
  it('does nothing while signed out', () => {
    useSyncStore.getState().start();
    expect(fullSync).not.toHaveBeenCalled();
    vi.advanceTimersByTime(120_000);
    expect(pullSince).not.toHaveBeenCalled();
  });

  it('begins auto-sync immediately if already signed in when start() is called', async () => {
    useAuthStore.setState({ email: 'a@b.com' });
    useSyncStore.getState().start();
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(1));
  });

  it('a null->value email transition triggers fullSync and starts the pull interval', async () => {
    useSyncStore.getState().start();
    expect(fullSync).not.toHaveBeenCalled();

    useAuthStore.setState({ email: 'a@b.com' });
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(60_000);
    expect(pullSince).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(pullSince).toHaveBeenCalledTimes(2);
  });

  it('a value->null email transition (sign-out) stops the pull interval', async () => {
    useAuthStore.setState({ email: 'a@b.com' });
    useSyncStore.getState().start();
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(1));

    useAuthStore.setState({ email: null });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(pullSince).not.toHaveBeenCalled();
  });

  it('calling start() twice only registers one subscription (idempotent)', async () => {
    useSyncStore.getState().start();
    useSyncStore.getState().start();
    useAuthStore.setState({ email: 'a@b.com' });
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(1));
    expect(fullSync).toHaveBeenCalledTimes(1); // not 2
  });

  it('a focus event while signed in triggers an immediate pull', async () => {
    useAuthStore.setState({ email: 'a@b.com' });
    useSyncStore.getState().start();
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(pullSince).toHaveBeenCalledTimes(1));
  });

  it('an online event while signed in triggers a full sync', async () => {
    useAuthStore.setState({ email: 'a@b.com' });
    useSyncStore.getState().start();
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(2));
  });

  it('updates status and lastSyncedAt after a successful sync', async () => {
    useAuthStore.setState({ email: 'a@b.com' });
    useSyncStore.getState().start();
    await vi.waitFor(() => expect(useSyncStore.getState().status).toBe('synced'));
    expect(useSyncStore.getState().lastSyncedAt).toEqual(expect.any(Number));
  });
});

describe('syncStore — scheduleDirtyPush()', () => {
  it('multiple rapid calls within the debounce window result in exactly one pushDirty call', async () => {
    useSyncStore.getState().scheduleDirtyPush();
    vi.advanceTimersByTime(1000);
    useSyncStore.getState().scheduleDirtyPush();
    vi.advanceTimersByTime(1000);
    useSyncStore.getState().scheduleDirtyPush();

    await vi.advanceTimersByTimeAsync(3000);
    expect(pushDirty).toHaveBeenCalledTimes(1);
  });

  it('fires after the debounce window elapses with no further calls', async () => {
    useSyncStore.getState().scheduleDirtyPush();
    await vi.advanceTimersByTimeAsync(3000);
    expect(pushDirty).toHaveBeenCalledTimes(1);
  });

  it('a call while signed out still resolves harmlessly (no thrown error)', async () => {
    expect(() => useSyncStore.getState().scheduleDirtyPush()).not.toThrow();
    await vi.advanceTimersByTimeAsync(3000);
    expect(pushDirty).toHaveBeenCalledTimes(1); // pushDirty itself no-ops internally when signed out
  });

  it('visibilitychange to hidden flushes a pending debounce immediately', async () => {
    useSyncStore.getState().start();
    useSyncStore.getState().scheduleDirtyPush();
    setVisibility('hidden');
    await vi.waitFor(() => expect(pushDirty).toHaveBeenCalledTimes(1));

    // The flushed call shouldn't fire again when the original debounce would have elapsed.
    await vi.advanceTimersByTimeAsync(3000);
    expect(pushDirty).toHaveBeenCalledTimes(1);
  });

  it('visibilitychange to hidden with no pending debounce does nothing', async () => {
    useSyncStore.getState().start();
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(100);
    expect(pushDirty).not.toHaveBeenCalled();
  });
});

describe('syncStore — syncNow()', () => {
  it('calls fullSync and updates lastSyncedAt', async () => {
    await useSyncStore.getState().syncNow();
    expect(fullSync).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().status).toBe('synced');
    expect(useSyncStore.getState().lastSyncedAt).toEqual(expect.any(Number));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- syncStore.test.ts` (from `kb-app/`)
Expected: FAIL — `./syncStore` does not exist yet.

- [ ] **Step 3: Implement `kb-app/src/store/syncStore.ts`**

```ts
import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { fullSync, pullSince, pushDirty } from '../lib/sync';

const DIRTY_PUSH_DEBOUNCE_MS = 3000;
const PULL_INTERVAL_MS = 60_000;

interface SyncState {
  status: 'idle' | 'synced';
  lastSyncedAt: number | null;
  start: () => void;
  scheduleDirtyPush: () => void;
  syncNow: () => Promise<void>;
}

let started = false;
let dirtyTimeoutId: ReturnType<typeof setTimeout> | null = null;
let pullIntervalId: ReturnType<typeof setInterval> | null = null;
let lastPullAt = 0;
let handleFocus: (() => void) | null = null;
let handleOnline: (() => void) | null = null;
let handleVisibilityChange: (() => void) | null = null;
let unsubscribeAuth: (() => void) | null = null;

export const useSyncStore = create<SyncState>()((set) => {
  function markSynced() {
    set({ status: 'synced', lastSyncedAt: Date.now() });
  }

  function beginAutoSync() {
    void fullSync().then(() => {
      lastPullAt = Date.now();
      markSynced();
    });

    pullIntervalId = setInterval(() => {
      void pullSince(lastPullAt).then(() => {
        lastPullAt = Date.now();
        markSynced();
      });
    }, PULL_INTERVAL_MS);

    handleFocus = () => {
      void pullSince(lastPullAt).then(() => {
        lastPullAt = Date.now();
        markSynced();
      });
    };
    handleOnline = () => {
      void fullSync().then(() => {
        lastPullAt = Date.now();
        markSynced();
      });
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
  }

  function endAutoSync() {
    if (pullIntervalId !== null) {
      clearInterval(pullIntervalId);
      pullIntervalId = null;
    }
    if (handleFocus) {
      window.removeEventListener('focus', handleFocus);
      handleFocus = null;
    }
    if (handleOnline) {
      window.removeEventListener('online', handleOnline);
      handleOnline = null;
    }
  }

  return {
    status: 'idle',
    lastSyncedAt: null,

    // Guarded against React 19 StrictMode's double-invoked mount effect (and
    // HMR) registering a second authStore subscription with no way to
    // unsubscribe — same pattern as authStore.init()'s `initialized` guard.
    start: () => {
      if (started) return;
      started = true;

      // Belt-and-suspenders: covers the (currently hypothetical) case where
      // authStore's session already resolved before this runs, in addition
      // to the normal case below where the subscription catches it.
      if (useAuthStore.getState().email) {
        beginAutoSync();
      }

      unsubscribeAuth = useAuthStore.subscribe((state, prevState) => {
        if (!prevState.email && state.email) beginAutoSync();
        else if (prevState.email && !state.email) endAutoSync();
      });

      handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden' && dirtyTimeoutId !== null) {
          clearTimeout(dirtyTimeoutId);
          dirtyTimeoutId = null;
          void pushDirty().then(markSynced);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
    },

    // Safe to call regardless of sign-in state — pushDirty() itself already
    // no-ops instantly when signed out, so this never needs to check.
    scheduleDirtyPush: () => {
      if (dirtyTimeoutId !== null) {
        clearTimeout(dirtyTimeoutId);
      }
      dirtyTimeoutId = setTimeout(() => {
        dirtyTimeoutId = null;
        void pushDirty().then(markSynced);
      }, DIRTY_PUSH_DEBOUNCE_MS);
    },

    syncNow: async () => {
      await fullSync();
      lastPullAt = Date.now();
      markSynced();
    },
  };
});

/** Test-only: resets start()'s idempotence guard and all module-level
 *  timer/listener state so each test starts from a clean slate. Not used by
 *  application code. */
export function __resetSyncStoreForTests(): void {
  started = false;
  if (unsubscribeAuth) {
    unsubscribeAuth();
    unsubscribeAuth = null;
  }
  if (dirtyTimeoutId !== null) {
    clearTimeout(dirtyTimeoutId);
    dirtyTimeoutId = null;
  }
  if (pullIntervalId !== null) {
    clearInterval(pullIntervalId);
    pullIntervalId = null;
  }
  if (handleFocus) {
    window.removeEventListener('focus', handleFocus);
    handleFocus = null;
  }
  if (handleOnline) {
    window.removeEventListener('online', handleOnline);
    handleOnline = null;
  }
  if (handleVisibilityChange) {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    handleVisibilityChange = null;
  }
  lastPullAt = 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- syncStore.test.ts` (from `kb-app/`)
Expected: PASS on every case. If a fake-timers test hangs or times out, check whether the assertion needs `vi.advanceTimersByTimeAsync` (which also flushes microtasks between ticks — required here since `beginAutoSync`/`scheduleDirtyPush`'s callbacks are `async`/return promises) rather than the sync `vi.advanceTimersByTime`.

- [ ] **Step 5: Full pipeline check and commit**

Run: `npm run typecheck && npm run lint && npm run test && npm run build` (from `kb-app/`)
Expected: all green.

```bash
git add kb-app/src/store/syncStore.ts kb-app/src/store/syncStore.test.ts
git commit -m "feat: add syncStore for auto-sync orchestration"
```

---

### Task 2: `userDataStore.ts` wiring

**Files:**
- Modify: `kb-app/src/store/userDataStore.ts`
- Test: `kb-app/src/store/userDataStore.test.ts`

**Interfaces:**
- Consumes: `useSyncStore` from `./syncStore` (Task 1) — only `.getState().scheduleDirtyPush()`.
- Produces: no new exports — this task only adds one line to four existing actions.

- [ ] **Step 1: Write the failing tests**

Add `import { useSyncStore } from './syncStore';` to `kb-app/src/store/userDataStore.test.ts`'s existing import block. Then add one `it` to each of the `cycleStatus`, `toggleFavorite`, `setNote`, and `gradeCard` `describe` blocks (placed as the last test in each block), plus one new test in the `recordView` block:

```ts
    // inside describe('cycleStatus', ...):
    it('schedules a debounced sync push', () => {
      const scheduleSpy = vi.spyOn(useSyncStore.getState(), 'scheduleDirtyPush').mockImplementation(() => {});
      useUserDataStore.getState().cycleStatus('topic-a');
      expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });
```

```ts
    // inside describe('toggleFavorite', ...):
    it('schedules a debounced sync push', () => {
      const scheduleSpy = vi.spyOn(useSyncStore.getState(), 'scheduleDirtyPush').mockImplementation(() => {});
      useUserDataStore.getState().toggleFavorite('topic-a');
      expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });
```

```ts
    // inside describe('setNote', ...):
    it('schedules a debounced sync push', () => {
      const scheduleSpy = vi.spyOn(useSyncStore.getState(), 'scheduleDirtyPush').mockImplementation(() => {});
      useUserDataStore.getState().setNote('topic-a', 'hello');
      expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });
```

```ts
    // inside describe('gradeCard', ...):
    it('schedules a debounced sync push', () => {
      const scheduleSpy = vi.spyOn(useSyncStore.getState(), 'scheduleDirtyPush').mockImplementation(() => {});
      useUserDataStore.getState().gradeCard('topic-a', 'good');
      expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });
```

```ts
    // inside describe('recordView', ...):
    it('does NOT schedule a sync push — recents never sync', () => {
      const scheduleSpy = vi.spyOn(useSyncStore.getState(), 'scheduleDirtyPush').mockImplementation(() => {});
      useUserDataStore.getState().recordView('topic-a');
      expect(scheduleSpy).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- userDataStore.test.ts` (from `kb-app/`)
Expected: FAIL on the four new "schedules a debounced sync push" tests (the calls don't happen yet); the `recordView` "does NOT schedule" test passes vacuously already (no call was ever going to happen) — that's fine, it becomes a real regression guard once Step 3 is done.

- [ ] **Step 3: Implement**

In `kb-app/src/store/userDataStore.ts`, add one import line (after the existing `../lib/db` import):

```ts
import { useSyncStore } from './syncStore';
```

Then add one line to the end of each of these four actions (immediately after their existing `void persistX(...)` call):

- `setStatus`, after `void persistSetProgress(topicId, status);`:
  ```ts
  useSyncStore.getState().scheduleDirtyPush();
  ```
- `toggleFavorite`, after `void persistSetFavorite(topicId, willBeFavorite);`:
  ```ts
  useSyncStore.getState().scheduleDirtyPush();
  ```
- `setNote`, after `void persistSetNote(topicId, text);`:
  ```ts
  useSyncStore.getState().scheduleDirtyPush();
  ```
- `gradeCard`, after `void persistSetSrsCard(next);`:
  ```ts
  useSyncStore.getState().scheduleDirtyPush();
  ```

`cycleStatus` needs no direct change — it already calls `get().setStatus(...)`, which now schedules the push on its own. `recordView` is untouched.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- userDataStore.test.ts` (from `kb-app/`)
Expected: PASS — all five new tests, plus every pre-existing test in the file (the new `scheduleDirtyPush()` calls are fire-and-forget, same shape as the existing `void persistX(...)` calls, so they can't affect any synchronous state assertion already in the file).

- [ ] **Step 5: Full pipeline check and commit**

Run: `npm run typecheck && npm run lint && npm run test && npm run build` (from `kb-app/`)
Expected: all green.

```bash
git add kb-app/src/store/userDataStore.ts kb-app/src/store/userDataStore.test.ts
git commit -m "feat: wire userDataStore writes to syncStore's debounced push"
```

---

### Task 3: `App.tsx` wiring + `Settings.tsx` UI

**Files:**
- Modify: `kb-app/src/App.tsx`
- Modify: `kb-app/src/pages/Settings.tsx`
- Test: `kb-app/src/App.test.tsx`
- Test: `kb-app/src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `useSyncStore` from `../store/syncStore` (Task 1) — `.getState().start()` (App.tsx), `.getState().syncNow()` and the `status`/`lastSyncedAt` state (Settings.tsx, via the `useSyncStore((s) => ...)` hook).
- Produces: no new exports — UI/wiring only.

- [ ] **Step 1: Write the failing tests**

In `kb-app/src/App.test.tsx`: add `import { useSyncStore } from './store/syncStore';` to the imports. Add a module-scoped `startSpy` variable right next to the existing `let initSpy: ReturnType<typeof vi.spyOn>;` declaration:

```ts
let startSpy: ReturnType<typeof vi.spyOn>;
```

In `beforeEach`, right after the existing `initSpy = vi.spyOn(...)` line, add:

```ts
  startSpy = vi.spyOn(useSyncStore.getState(), 'start').mockImplementation(() => {});
```

Add one new test, placed right after the existing `'calls authStore.init() once on mount'` test, following that test's exact shape:

```ts
  it('calls syncStore.start() once on mount', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(startSpy).toHaveBeenCalledTimes(1));
  });
```

In `kb-app/src/pages/Settings.test.tsx`: add `import { useSyncStore } from '../store/syncStore';` to the imports. In the existing top-level `beforeEach`, add a reset line alongside the existing `useAuthStore.setState(...)`:

```ts
  useSyncStore.setState({ status: 'idle', lastSyncedAt: null });
```

Add a new `describe` block:

```ts
describe('Settings — sync status', () => {
  it('shows nothing sync-related when signed out', () => {
    renderSettings();
    expect(screen.queryByText(/מסונכרן/)).not.toBeInTheDocument();
  });

  it('shows "מעולם לא" when signed in but never synced', () => {
    useAuthStore.setState({ email: 'signed-in@example.com' });
    renderSettings();
    expect(screen.getByText(/מעולם לא/)).toBeInTheDocument();
  });

  it('shows a relative time when lastSyncedAt is set', () => {
    useAuthStore.setState({ email: 'signed-in@example.com' });
    useSyncStore.setState({ status: 'synced', lastSyncedAt: Date.now() - 5 * 60 * 1000 });
    renderSettings();
    expect(screen.getByText(/לפני 5 דקות/)).toBeInTheDocument();
  });

  it('clicking "סנכרן עכשיו" calls syncNow()', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ email: 'signed-in@example.com' });
    const syncNowSpy = vi.spyOn(useSyncStore.getState(), 'syncNow').mockResolvedValue(undefined);
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'סנכרן עכשיו' }));

    expect(syncNowSpy).toHaveBeenCalledTimes(1);
  });

  it('the "(בקרוב)" text is gone from the signed-out helper text', () => {
    renderSettings();
    expect(screen.getByText(/התחבר כדי לסנכרן נתונים בין מכשירים/)).not.toHaveTextContent('בקרוב');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- App.test.tsx Settings.test.tsx` (from `kb-app/`)
Expected: FAIL — `syncStore.ts` itself already exists (Task 1), so these tests' imports resolve fine, but `App.tsx`/`Settings.tsx` haven't been changed yet: `start()` is never called on mount, and the status line/button don't exist in `Settings.tsx`'s rendered output.

- [ ] **Step 3: Implement**

In `kb-app/src/App.tsx`, replace the mount effect:

```tsx
  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
    void import('./store/authStore').then(({ useAuthStore }) => useAuthStore.getState().init());
  }, []);
```

with:

```tsx
  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
    void import('./store/authStore')
      .then(({ useAuthStore }) => {
        useAuthStore.getState().init();
        return import('./store/syncStore');
      })
      .then(({ useSyncStore }) => useSyncStore.getState().start());
  }, []);
```

In `kb-app/src/pages/Settings.tsx`:

1. Add an import: `import { useSyncStore } from '../store/syncStore';`

2. Add a local relative-time formatter, placed next to the existing `backupFileName` helper:

```ts
function formatLastSynced(lastSyncedAt: number | null): string {
  if (lastSyncedAt === null) return 'מעולם לא';
  const elapsedMs = Date.now() - lastSyncedAt;
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return 'הרגע';
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}
```

3. Inside the `Settings` component function, add two more store reads alongside the existing `email`/`isSending` ones:

```ts
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
```

4. Add a `handleSyncNow` function alongside the other handlers:

```ts
  async function handleSyncNow() {
    await useSyncStore.getState().syncNow();
  }
```

5. Inside the signed-in branch of the Account section (the `email ? (...) : (...)` block), after the existing sign-out button, add:

```tsx
              <p className="text-sm text-[var(--kb-muted)]">{`מסונכרן לאחרונה: ${formatLastSynced(lastSyncedAt)}`}</p>
              <button
                type="button"
                onClick={handleSyncNow}
                className="min-h-11 w-fit rounded-md border border-[var(--kb-border)] px-4 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
              >
                סנכרן עכשיו
              </button>
```

6. In the signed-out branch, change:

```tsx
              <p className="text-sm text-[var(--kb-muted)]">התחבר כדי לסנכרן נתונים בין מכשירים (בקרוב).</p>
```

to:

```tsx
              <p className="text-sm text-[var(--kb-muted)]">התחבר כדי לסנכרן נתונים בין מכשירים.</p>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- App.test.tsx Settings.test.tsx` (from `kb-app/`)
Expected: PASS — all new tests, plus every pre-existing test in both files.

- [ ] **Step 5: Full pipeline check, manual theme/RTL check, and commit**

Run: `npm run typecheck && npm run lint && npm run test && npm run build` (from `kb-app/`)
Expected: all green.

Manual (per golden rules 5-6, `kb-app/CLAUDE.md`): `npm run dev`, sign in with a placeholder email (the magic-link send itself will fail without a real Supabase project, but the Account section's layout — including the sync status line and button once `email` is set via dev tools/React DevTools state override if needed — should still render correctly), check light theme, dark theme, RTL, and keyboard-only access to the new button (`focus-visible` outline present, reachable via Tab).

```bash
git add kb-app/src/App.tsx kb-app/src/App.test.tsx kb-app/src/pages/Settings.tsx kb-app/src/pages/Settings.test.tsx
git commit -m "feat: start syncStore on mount; add sync status + manual sync button to Settings"
```

---

## Definition of Done (whole plan)

- `kb-app/src/store/syncStore.ts` exports `useSyncStore` with the shape in Task 1's Interfaces.
- `kb-app/src/store/userDataStore.ts`'s four syncable actions call `scheduleDirtyPush()`; `recordView` does not.
- `kb-app/src/App.tsx` starts `syncStore` via the chained dynamic import.
- `kb-app/src/pages/Settings.tsx` shows the status line + manual button when signed in, and no longer says "(בקרוב)" when signed out.
- No change to `kb-app/src/lib/sync.ts`, `kb-app/src/lib/db.ts`, or `kb-app/supabase/schema.sql`.
- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- Light theme, dark theme, RTL, keyboard access manually checked on the new Settings UI.
- Manual end-to-end verification (two devices actually syncing) remains deferred — no live Supabase project exists yet; not a blocker, per the spec's own Testing section.
