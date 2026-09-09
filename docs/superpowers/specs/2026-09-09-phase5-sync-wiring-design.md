# Phase 5, Sub-project #3c — Sync Wiring + Auto-Sync: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** [[2026-09-09-phase5-sync-engine-core-design]] (`fullSync`/`pushDirty`/`pullSince` from `lib/sync.ts`) and the Auth sub-project's `authStore` (`email`, `init()`). No live Supabase project needed to implement or test this piece — same mocking approach as #3b — but it can only be manually verified end-to-end once one exists.
**Scope boundary:** the third and final piece of Phase 5's original Sub-project #3 ("סכימת DB + מנוע סנכרון"). This piece wires the already-built, already-reviewed sync engine into the running app: when it runs, how often, what a local write does, and what the user sees. No changes to `lib/sync.ts`'s three exported functions or their contracts — this sub-project only calls them.

## Goal

Make sync actually happen without the user doing anything, once they're signed in — and give them one line of visibility into it — while keeping every golden rule intact: still works fully offline/signed-out, IndexedDB stays authoritative, no UI ever blocks on the network.

## Out of scope

Any change to `lib/sync.ts`, `lib/db.ts`, or `supabase/schema.sql` (all already merged and reviewed in #3a/#3b). Real-time/live updates from other devices (this is polling-based, not a websocket subscription — matching the original backend doc's design). Surfacing per-table partial-sync failures in the UI (see Section 3 — `fullSync`/`pushDirty`/`pullSince` don't report them, by design, and reopening that contract is out of scope here).

## Section 1: `syncStore.ts` — orchestration

New file, `kb-app/src/store/syncStore.ts`, a Zustand store matching the existing one-store-per-domain pattern (`userDataStore`, `authStore`, `uiStore`):

```ts
interface SyncState {
  status: 'idle' | 'synced';
  lastSyncedAt: number | null;
  start: () => void;
  scheduleDirtyPush: () => void;
  syncNow: () => Promise<void>;
}
```

**`start()`** (idempotence-guarded the same way `authStore.init()` already is — a module-level `started` boolean, so React 19 StrictMode's double-invoked mount effect can't register the subscription twice): subscribes to `useAuthStore` with a manually-diffed email (Zustand's base `store.subscribe(listener)` receives `(state, prevState)`; no `subscribeWithSelector` middleware needed for one field):

```ts
useAuthStore.subscribe((state, prevState) => {
  if (!prevState.email && state.email) onSignedIn();
  else if (prevState.email && !state.email) onSignedOut();
});
```

`onSignedIn()`: calls `fullSync()`, then (regardless of whether it's the very first sign-in this session or a page reload where a session already existed) sets `lastPullAt = Date.now()` and starts: a 60-second `setInterval` calling `pullSince(lastPullAt)` then updating `lastPullAt`; a `focus` listener doing the same on demand; an `online` listener calling `fullSync()` (a reconnect deserves the thorough reconciliation, matching `04-BACKEND-SUPABASE-SYNC.md`'s original "on reconnect, full pull" intent). Each of these three also sets `status: 'synced', lastSyncedAt: Date.now()` after the call resolves (they always resolve, never reject, per `lib/sync.ts`'s existing contract).

`onSignedOut()`: clears the interval and removes the `focus`/`online` listeners; leaves `lastSyncedAt` as the last real value (no reason to blank it — it's still true information: "that's when it last synced, before signing out").

Because the subscription reacts to a **transition**, not a one-time check, it correctly covers both a fresh sign-in during this session and the async session-hydration on page load (`authStore.init()`'s `getSession()` call resolves a bit after mount, setting `email` for the first time). `start()` also checks `useAuthStore.getState().email` once synchronously before subscribing, and begins auto-sync immediately if already truthy — belt-and-suspenders against a future reordering where `authStore` resolves its session before `syncStore.start()` runs (not how `App.tsx`'s current chained dynamic import behaves today, but cheap to guard against regardless).

**`scheduleDirtyPush()`**: a shared debounce (3000ms constant, named `DIRTY_PUSH_DEBOUNCE_MS`) — each call clears any pending timeout and sets a new one calling `pushDirty()` (then `status: 'synced', lastSyncedAt: Date.now()`). Calling this while signed out is harmless: `pushDirty()` already no-ops instantly (checks `getSupabase()`/session itself), so `scheduleDirtyPush()` never needs to know or check auth state. A `visibilitychange` listener (added once, in `start()`) flushes any pending debounce immediately when the tab becomes hidden — same "don't lose an edit on the way out" reasoning as `TopicNotes.tsx`'s existing flush-on-blur.

**`syncNow()`**: the manual button's handler. Sets `status` unchanged (see Section 3 on why there's no `'syncing'` state), calls `fullSync()` directly (full reconciliation — appropriate for an infrequent, user-initiated action), then updates `lastSyncedAt`.

## Section 2: `userDataStore.ts` — four call sites

Each of `setStatus`, `toggleFavorite`, `setNote`, `gradeCard` gets one added line, immediately after its existing `void persistX(...)` call: `useSyncStore.getState().scheduleDirtyPush();`. `recordView` is untouched — `recents` never syncs (established in #3a). This is the only change to this file; no new imports beyond `useSyncStore`, no change to any existing exported shape or test-visible behavior beyond the new side effect.

## Section 3: Status semantics — the one real tradeoff

`fullSync()`, `pushDirty()`, and `pullSince()` never throw and never report per-table failure to their caller — that was a deliberate, already-reviewed design choice in #3b (golden rule 3: never block or fail the UI over backend/network issues; a failing table self-heals on the next cycle). That means `syncStore` genuinely cannot distinguish "everything synced cleanly" from "it ran, and one of four tables silently failed" — both look like a resolved promise.

Given that, `status` only has two states: `'idle'` (never signed in this session) and `'synced'` (at least one sync call has completed — successfully or with an invisible partial failure). There's no `'syncing'` transient state either — every call in this design already resolves in well under a second against ~160 rows, and a flickering spinner for a sub-second, backgrounded operation would add complexity for no real user benefit. `lastSyncedAt` and its human-readable relative-time display are still meaningful and honest ("it ran at this time"); what's not promised is "it definitely fully succeeded." Reopening `lib/sync.ts`'s no-throw contract to fix this is out of scope for this sub-project (see Out of scope) — a real per-table error surface, if ever wanted, is its own future design.

## Section 4: `App.tsx` — starting the store

Same dynamic-import pattern already used for `authStore` (keeps `@supabase/supabase-js` and its dependents out of the eager main bundle when unconfigured):

```ts
useEffect(() => {
  void useUserDataStore.getState().loadUserData();
  void import('./store/authStore').then(({ useAuthStore }) => {
    useAuthStore.getState().init();
    return import('./store/syncStore');
  }).then(({ useSyncStore }) => useSyncStore.getState().start());
}, []);
```

Chained (not run in parallel) so `authStore`'s module — and therefore `useAuthStore` itself as an import target — is guaranteed loaded before `syncStore.start()` sets up its subscription to it. `authStore.init()`'s own internal `getSession()` call doesn't need to be awaited first: as established in Section 1, `syncStore` reacts to the future email transition whenever it happens, not to a snapshot taken at `start()` time.

## Section 5: `Settings.tsx` — status line + manual button

Inside the existing "חשבון" section, only rendered when `email` is set (signed out already shows the sign-in form and has nothing to sync):

- A line: `` מסונכרן לאחרונה: {relative-time or 'מעולם לא'} `` reading `useSyncStore((s) => s.lastSyncedAt)`. Relative time via a small local helper (seconds/minutes/hours/days — no new dependency; this codebase has no date library and the granularity needed is coarse).
- A "סנכרן עכשיו" button calling `useSyncStore.getState().syncNow()`, same styling/`min-h-11` pattern as the page's other buttons.
- The existing sign-in form's helper text "התחבר כדי לסנכרן נתונים בין מכשירים **(בקרוב)**" loses the "(בקרוב)" — sync is no longer "coming soon" once this sub-project ships.

No new `role="status"`/`role="alert"` region needed — this isn't an action-triggered success/error message like the export/import/auth flows, it's a passively-updating status line (`lastSyncedAt` reads live from the store on every render, no explicit announcement needed for a background process, matching how e.g. a "last saved" indicator elsewhere would behave).

## Testing

- `syncStore.test.ts` (new): `start()` — subscribing before any email is set does nothing; email transitioning null→value triggers one `fullSync()` call and starts the interval (mock `vi.useFakeTimers()`, advance 60s, confirm `pullSince` called with the expected timestamp); email transitioning value→null stops the interval (advance time after sign-out, confirm no further calls). `scheduleDirtyPush()` — multiple rapid calls within the debounce window result in exactly one `pushDirty()` call; a call while signed out still resolves harmlessly (no thrown error, matching `pushDirty`'s own no-op contract — no special-casing needed in `scheduleDirtyPush` itself). `visibilitychange` to hidden flushes a pending debounce immediately (mock `document.visibilityState`/dispatch the event). `syncNow()` calls `fullSync()` and updates `lastSyncedAt`.
- `userDataStore.test.ts`: extend the existing tests for `setStatus`/`toggleFavorite`/`setNote`/`gradeCard` to also assert `scheduleDirtyPush` was called once per action (mock `syncStore` the same way `Settings.test.tsx` likely already mocks `authStore`, or via `vi.spyOn` on the store's `getState()` return). Confirm `recordView` does NOT call it.
- `Settings.test.tsx`: extend to cover the new status line (renders "מעולם לא" when `lastSyncedAt` is null, a relative-time string otherwise) and the manual sync button (click → `syncNow()` called). Confirm the "(בקרוב)" text is gone from the signed-out helper text.
- Manual, deferred until a live project exists: sign in on two browser profiles, make a change on one, confirm it appears on the other within ~60s (or immediately via the manual button); go offline, make a change, go back online, confirm it pushes without user action.

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- `kb-app/src/store/syncStore.ts` exports `useSyncStore` with the shape in Section 1.
- `kb-app/src/store/userDataStore.ts`'s four syncable actions call `scheduleDirtyPush()`; `recordView` does not.
- `kb-app/src/App.tsx` starts `syncStore` via the chained dynamic import in Section 4.
- `kb-app/src/pages/Settings.tsx` shows the status line + manual button when signed in, and no longer says "(בקרוב)" when signed out.
- No change to `kb-app/src/lib/sync.ts`, `kb-app/src/lib/db.ts`, or `kb-app/supabase/schema.sql`.
- Light theme, dark theme, RTL, keyboard access checked on the new Settings UI (golden rules 5-6).
