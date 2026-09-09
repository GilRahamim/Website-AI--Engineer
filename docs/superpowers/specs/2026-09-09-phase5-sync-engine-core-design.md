# Phase 5, Sub-project #3b — Sync Engine Core: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** [[2026-09-09-phase5-schema-rls-design]] (targets the tables/columns it defines) and [[2026-09-09-phase5-auth-design]] (`getSupabase()`, session state). Neither requires a live Supabase project to *implement* against — both are mocked in tests, same pattern as `authStore.test.ts` — but this piece cannot be manually verified end-to-end until a real project exists.
**Scope boundary:** the second of three pieces Phase 5's original Sub-project #3 was decomposed into. This piece is the sync engine's pure logic only — `pushDirty()`/`pullSince(ts)`/`fullSync()` in a new `kb-app/src/lib/sync.ts`, plus the low-level `db.ts` support they need. **No wiring into `userDataStore`, no auto-sync triggers (interval/focus/online listeners), no UI** — that's sub-project #3c.

## Goal

A self-contained module that can reconcile the four local IndexedDB stores (`progress`, `notes`, `favorites`, `srsCards`) against their Supabase counterparts in both directions — including correctly propagating deletions — without knowing anything about when or why it's called. Sub-project #3c will decide the "when."

## Out of scope

Any change to `userDataStore.ts`, any Settings-page UI, any timers/`online`/`focus` listeners (`startAutoSync()`), any React code at all. `recents` (still local-only, confirmed in sub-project #1 and absent from the schema). Smarter `notes.text` conflict merging (decided during brainstorming: plain last-write-wins for v1, same as every other field — see Section 2). Manual end-to-end verification against a real Supabase project (no project exists yet; this piece is fully testable against mocks, per Testing section).

## Section 1: What can actually be deleted

Fresh check against current code, not just the original `04-BACKEND-SUPABASE-SYNC.md` draft: only two of the four tables support a real local deletion path today —

- `favorites`: `db.ts`'s `setFavorite(topicId, false)` calls `db.delete('favorites', topicId)` (`db.ts:104`).
- `notes`: `db.ts`'s `setNote(topicId, '')` calls `db.delete('notes', topicId)` (`db.ts:149`).
- `progress` and `srsCards` rows are never deleted once created — `setProgress`/`setSrsCard` only ever `put()`.

The reconciliation algorithm (Section 2) is still applied uniformly to all four tables rather than special-casing two of them — the delete branch is simply a no-op path for `progress`/`srsCards` in practice, and a uniform algorithm is less code and less risk than two different sync paths per table.

## Section 2: Reconciliation algorithm

**New IndexedDB store: `syncMeta`** (`db.ts`, `DB_VERSION` 3 → 4, additive `if (!db.objectStoreNames.contains('syncMeta'))` branch, matching the existing upgrade pattern). One record, keyed by a fixed id:

```ts
interface SyncManifest {
  id: 'manifest';
  tables: Record<'progress' | 'notes' | 'favorites' | 'srsCards', string[]>; // topicIds as of last successful reconciliation
  syncedAt: number; // epoch ms
}
```

Absence of a manifest record (first sync ever, or a device that's never synced) is treated as `tables: { progress: [], notes: [], favorites: [], srsCards: [] }` — every local row looks "new" (push) and every remote row looks "new" (pull), which is exactly correct for a first sync: nothing has been deleted yet from this device's point of view, there's just a pile of rows to reconcile in both directions.

**Per table, per `fullSync()` call**, given `localRows` (from the existing `getAllX()`), `remoteRows` (a plain `select * from <table>`, scoped by RLS to the current user automatically), and `manifestIds` (the table's array from the stored manifest, or `[]`):

1. Build three id sets: `localIds`, `remoteIds`, `manifestIds`.
2. For each id in `localIds ∪ remoteIds`:
   - In both `localRows` and `remoteRows`: **conflict** — compare timestamps (`updatedAt`/`createdAt` locally vs. `updated_at`/`created_at` remotely, converted via `new Date(iso).getTime()`); the newer side wins and is written to the other side (push or pull the winner; the loser is overwritten). Exact tie (equal ms) → prefer the pulled/remote version, arbitrarily but deterministically (avoids a coin-flip; ties are already a vanishingly rare edge case for a single user).
   - Local only (present locally, absent remotely), id was in `manifestIds` → **local delete**: it existed on both sides at last sync, and remote no longer has it — remote lost it since (deleted elsewhere), so the local copy is deleted to match.
   - Local only, id was NOT in `manifestIds` → **push**: brand new local row, never synced before, upsert it remotely.
   - Remote only (present remotely, absent locally), id was in `manifestIds` → **remote delete**: it existed on both sides at last sync, and local no longer has it — *this* device deleted it since, so the deletion is pushed to remote.
   - Remote only, id was NOT in `manifestIds` → **pull**: brand new remote row (e.g. first sync on this device, or created on another device), upsert it locally.

   **(Correction from spec self-review, before implementation started: the first draft of this section had "local delete" and "remote delete" swapped — the direction of "who lost it since last sync" was backwards. Fixed above; this is the correct 3-way-merge classification against `manifestIds` as the common ancestor.)**
3. After all four tables are reconciled, write a new manifest: each table's array is the union of the (post-reconciliation) local and remote id sets, and `syncedAt = Date.now()`.

**`pushDirty()`** runs steps 1-2 above — including reading the stored manifest, same as `fullSync()`, so it can still correctly detect "this device deleted a row since last sync" — but only ever *writes to the remote side* (the push and remote-delete branches; pull/local-delete branches are computed but never applied) — cheap to call after every local write once #3c wires it in, without accidentally clobbering an in-flight local edit with a stale pull. **`pullSince(ts)`** is the mirror: also reads the manifest, applies pull/local-delete branches only, and additionally filters `remoteRows` server-side to `updated_at > ts` (a real query optimization here, unlike `fullSync`, since periodic polling shouldn't re-download all ~160 rows × 4 tables every time). Both share one internal `reconcileTable(table, direction, manifestIds)` helper with `fullSync()`, parameterized by which branches to apply and (for `pullSince`) the timestamp filter. Neither `pushDirty()` nor `pullSince()` *writes* the manifest afterward — only a successful `fullSync()` does, since a one-directional call only ever mutates one side and doesn't have full post-reconciliation information about the other (a `pullSince` might legitimately miss a remote delete that happened before its `ts` window, so its partial view shouldn't overwrite the stored manifest). A local deletion `pushDirty()` misses for any reason still gets caught by the next `fullSync()`, which has the complete picture.

## Section 3: `db.ts` additions

Two new low-level helpers, used only by `sync.ts` — the existing `setProgress`/`setFavorite`/`setNote`/`setSrsCard` always stamp `Date.now()`, which is correct for UI-driven writes but wrong for applying a pulled row (which must keep its true remote timestamp so future LWW comparisons stay correct):

```ts
export async function putRows<T extends 'progress' | 'notes' | 'favorites' | 'srsCards'>(
  table: T,
  rows: KbUserDataSchema[T]['value'][],
): Promise<void>;

export async function deleteRows(
  table: 'progress' | 'notes' | 'favorites' | 'srsCards',
  topicIds: string[],
): Promise<void>;
```

Both open one `readwrite` transaction per call (all rows/ids for one table in one transaction — same pattern as `importAllData`), follow the existing try/catch-and-`warnOnce` convention, and are additive exports — no existing `db.ts` function changes behavior.

Plus manifest read/write:

```ts
export async function getSyncManifest(): Promise<SyncManifest | null>;
export async function setSyncManifest(manifest: SyncManifest): Promise<void>;
```

## Section 4: Auth and Supabase access

Every exported `sync.ts` function starts the same way: call `getSupabase()` (`lib/supabase.ts`); a `null` return (no project configured) resolves immediately as a no-op — no throw, no partial work, matching golden rule 3 (never block the UI on network/backend). When a client exists, the function also checks for an active session (`supabase.auth.getUser()`); no session (signed out) is likewise a no-op. When both exist, `user.id` is read once per call and stamped onto every row this call pushes (`upsert({ ...row, user_id: user.id, updated_at: ... })`) — the schema has no default/trigger for `user_id`, so the client must supply it, and RLS's `with check` will reject a push that gets it wrong.

Timestamp conversion both ways (as established in the schema spec): push converts local epoch-ms → `new Date(ms).toISOString()`; pull converts remote `timestamptz` string → `new Date(iso).getTime()`.

## Section 5: Function contracts

```ts
export async function pushDirty(): Promise<void>;
export async function pullSince(ts: number): Promise<void>;
export async function fullSync(): Promise<void>;
```

All three: never throw (internal try/catch around each table's reconciliation, `warnOnce`-style logging on failure — one table failing doesn't abort the other three), never block on network beyond their own awaits (no caller-facing loading state to manage — that's sub-project #3c's concern if it wants one).

## Testing

`sync.test.ts`, mocking `lib/supabase.ts` the same way `authStore.test.ts` does (`vi.mock('../lib/supabase', () => ({ getSupabase: () => mockGetSupabase() }))` with a fake client exposing `.auth.getUser()` and `.from(table).select()/.upsert()/.delete().in('topic_id', ids)`), and real IndexedDB via `fake-indexeddb` (already the project's test setup) for the local side:

- `fullSync()`: new local row with no manifest entry → pushed (mock `.upsert` called with the row, `user_id` stamped, ISO timestamp). New remote row with no manifest entry → pulled into IndexedDB with its remote timestamp preserved (not `Date.now()`). Local row newer than remote (both present) → remote is overwritten (push wins). Remote row newer → local is overwritten (pull wins). Id present in manifest but now missing remotely (still present locally) → local row removed from IndexedDB, id no longer in the post-sync manifest. Id present in manifest but now missing locally (still present remotely) → remote delete called (mock `.delete().in(...)`). Manifest is correctly rewritten after a successful sync (union of resulting ids, updated `syncedAt`).
- `pushDirty()`: only calls `.upsert`/remote-delete, never writes to local IndexedDB, never writes the stored manifest. With a pre-existing manifest and a row deleted locally since, it still detects and pushes the remote delete (proving it reads the manifest even though it never writes one).
- `pullSince(ts)`: mock `.select` is asserted to include the `updated_at > ts` filter; only writes to local IndexedDB, never calls `.upsert`/delete against the mock remote, never writes the stored manifest.
- No-op cases: `getSupabase()` returns `null` → all three resolve with no mock calls and no IndexedDB writes. Mock client present but `auth.getUser()` resolves to no user (signed out) → same no-op behavior.
- One table's mocked remote call rejecting (e.g. `.upsert` throws) → the other three tables still reconcile; the function still resolves (not rejects).

Manual, not testable in jsdom, deferred until a live project exists: run `fullSync()` against a real Supabase project from two separate browser profiles (simulating two devices), confirm push/pull/delete propagate correctly in both directions and RLS actually blocks cross-user access (the schema spec's own deferred manual check already covers the RLS half of this).

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- `kb-app/src/lib/sync.ts` exports exactly `pushDirty`, `pullSince`, `fullSync` with the signatures in Section 5.
- `kb-app/src/lib/db.ts` gains `putRows`, `deleteRows`, `getSyncManifest`, `setSyncManifest`, and the `syncMeta` store (`DB_VERSION` 4) — no behavior change to any existing export.
- No changes to `kb-app/src/store/userDataStore.ts`, any file under `kb-app/src/pages/`, `kb-app/src/components/`, or `kb-app/src/App.tsx` — this piece is additive/lib-only.
- All Testing-section cases pass against mocks.
