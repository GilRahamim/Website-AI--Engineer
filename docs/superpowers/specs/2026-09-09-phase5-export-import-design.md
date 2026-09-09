# Phase 5, Sub-project #1 — Export/Import JSON Backup: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** nothing — no Supabase project, credentials, or `.env` required. Pure IndexedDB ↔ local file.
**Scope boundary:** the first of Phase 5's sub-projects ("Phase 5 — בקאנד + סנכרון", `site-build-docs/00-BUILD-README.md`, `04-BACKEND-SUPABASE-SYNC.md`, "ייצוא/גיבוי" section). Deliberately sequenced first because it needs no external account — sub-projects #2 (Supabase + Auth) and #3 (schema + sync engine) come after, once a real Supabase project exists.

## Goal

Give the user a manual, offline-independent safety net: a button that downloads all of their local data as one JSON file, and a way to restore it (e.g. after a browser data clear, or moving to a new device before sync exists).

## Out of scope

Supabase, Auth, and the cloud sync engine (sub-projects #2–#3 — this sub-project only touches IndexedDB and the filesystem). Any diffing/merge logic on import (see Section 2 — full overwrite only, decided during brainstorming). Automatic/scheduled backups. Importing a file produced by a different app or an older/foreign schema (validated and rejected, not translated — see Section 2).

## Section 1: Export

**New page:** `kb-app/src/pages/Settings.tsx`, routed at `/settings`, lazy-loaded via `React.lazy()` alongside Flashcards/Quiz/Map (not a common-path route like Home/Reader). Added to `App.tsx`'s existing shared `<Suspense>` boundary — no new boundary.

**New `lib/db.ts` function:**

```ts
export interface ExportPayload {
  version: 1;
  exportedAt: string; // ISO 8601
  data: {
    progress: Progress[];
    favorites: Favorite[];
    recents: Recent[];
    notes: Note[];
    srsCards: SrsCard[];
  };
}

export async function exportAllData(): Promise<ExportPayload>;
```

Implemented as `Promise.all([getAllProgress(), getAllFavorites(), getAllRecents(), getAllNotes(), getAllSrsCards()])`, reusing the five functions that already exist — no new IndexedDB reads, no new error handling (each already resolves to `[]` on failure per the file's existing `warnOnce` convention).

`recents` is included even though `04-BACKEND-SUPABASE-SYNC.md`'s original list only names progress/notes/favorites/srs — `recents` is still user data with its own IndexedDB store and there's no reason to silently drop it from a "back up everything" feature. It has no equivalent Supabase table (per that doc), so it stays IndexedDB/export-only; sub-project #3 simply won't sync it, which is fine — recency is low-stakes, device-local-feeling data.

**Settings page button** ("ייצא את הנתונים שלי"): calls `exportAllData()`, `JSON.stringify(payload, null, 2)`, and triggers a download via a `Blob` + temporary `<a download>` (revoked after click) named `kb-backup-<YYYY-MM-DD>.json` (date from `exportedAt`, formatted with local date, not UTC, to match what the user expects to see for "today").

## Section 2: Import

**File picker:** `<input type="file" accept="application/json">`, hidden and triggered by a styled "ייבוא נתונים" button (standard pattern for accessible custom-styled file inputs — a visually hidden native input, a `<label>`/button trigger, matching the project's existing accessibility bar).

**Validation, before anything touches IndexedDB:**
1. `JSON.parse()` the file's text — catch failure → error state, stop.
2. Structural check: top-level `version === 1` and `data` present with all five expected keys, each an array. Each row spot-checked for its table's required keys (`topicId` on every row; `status` for progress rows and one of the valid `ProgressStatus` values; `updatedAt`/`createdAt`/`viewedAt`/`ease` etc. present and the right JS `typeof`). Anything short of that → error state, stop. This is deliberately structural/shape validation, not full schema re-derivation — good enough to reject a garbage/foreign file, not a general-purpose JSON schema validator.
3. Only if valid: `window.confirm('הפעולה תחליף את כל הנתונים המקומיים הקיימים. להמשיך?')`. Cancel → stop, no changes made, no error shown (this isn't a failure, just a no-op).
4. On confirm: call the new `importAllData(payload.data)`.

**New `lib/db.ts` function:**

```ts
export async function importAllData(data: ExportPayload['data']): Promise<void>;
```

Opens a single `readwrite` transaction across all five object stores, `clear()`s each, then `put()`s every row from the payload, and awaits `tx.done` — one atomic operation, so a mid-import failure can't leave some stores overwritten and others stale. Follows the file's existing try/catch-and-`warnOnce` convention; on failure, the Settings page shows a generic "הייבוא נכשל" error (rare — would mean IndexedDB itself is unavailable, already the fallback condition every other function in this file handles the same way).

**After a successful import:** the Settings page calls `useUserDataStore.getState().loadUserData()` (the same function `App.tsx` already calls on mount) to refresh in-memory state from the now-overwritten IndexedDB, then shows a success message ("הנתונים יובאו בהצלחה"). No page reload needed — every screen already reads from the Zustand store, which just got refreshed.

**Full overwrite, not merge:** decided during brainstorming. Simpler, matches the "restore a backup" mental model, and the `confirm()` warning makes the destructive nature explicit before it happens. A row-level last-write-wins merge (the strategy sub-project #3's sync engine will use) was considered and declined here — it's real complexity this sub-project doesn't need, and sub-project #3 will introduce it in the one place it's actually required.

## Section 3: Navigation entries

- `Header.tsx`: one more `<Link to="/settings">` in the existing nav row, labeled "הגדרות", same styling as the Flashcards/Quiz/Map links already there.
- `lib/commandPalette.ts`: one more entry in `buildActionList()`, `{ id: 'settings', label: 'הגדרות' }`, wired into `CommandPalette.tsx`'s existing `id → navigate()` switch the same way `'map'`/`'flashcards'`/`'quiz'` already are.

## Section 4: Settings page structure

Two sections on one page (no tabs/sub-routes needed for two actions):
- Export: a short description + the export button (always enabled).
- Import: description + hidden file input/button + inline `role="status"`/`role="alert"` region for validation errors and the post-import success message (same one-`role`-swaps-content pattern `TopicReader.tsx`'s content states already use elsewhere in this codebase).

No new visual components needed — plain buttons/text using existing `--kb-*` tokens, matching every other page's styling.

## Testing

- `db.test.ts`: `exportAllData()` returns the right shape from seeded stores; `importAllData()` round-trips (export → import into a cleared DB → export again → deep-equal minus `exportedAt`); `importAllData()` fully replaces pre-existing rows (seed different data first, import, assert only imported rows remain).
- `Settings.test.tsx` (new): export button triggers a `Blob`/anchor-download call (mock `URL.createObjectURL`/click, assert filename pattern and content); import with a valid mocked `File` → confirms via mocked `window.confirm` → success message shown, `loadUserData` effectively re-invoked (assert store state reflects imported data); import with malformed JSON → error message, `window.confirm` never called, IndexedDB untouched; import with structurally-invalid-but-parseable JSON (e.g. missing `data.progress`) → same error path; `window.confirm` returning `false` → no error, no success message, no store change.
- `Header.test.tsx` / `commandPalette.test.ts`: extend existing nav/action-list assertions to include the new "הגדרות" entry, matching how the Flashcards/Quiz/Map entries are already asserted.
- Manual, not testable in jsdom: `npm run build && npm run preview` — export a real file, inspect its JSON in a text editor; clear site data via DevTools, import that file back, confirm all progress/notes/favorites/SRS state is restored; attempt importing a non-JSON file and an unrelated JSON file, confirm both are rejected cleanly with no partial state change.

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- Manual export→clear→import round-trip (above) passes.
- Light theme, dark theme, RTL checked on the new Settings page and its nav entries.
- Keyboard-only: file picker trigger and both buttons reachable and operable via keyboard, `focus-visible` present (golden rule 6).
- No hardcoded colors — only `--kb-*` tokens (golden rule 7).
- No regression to Header/CommandPalette's existing links/actions or to any other page.
