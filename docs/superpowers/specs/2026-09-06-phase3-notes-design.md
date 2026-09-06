# Phase 3, Sub-project #2 — Personal Notes: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** Phase 2 (Frontend Core) and Phase 3 sub-project #1 (Foundation + Progress Tracking + Favorites + Recently Viewed) — both complete and merged (`docs/superpowers/specs/2026-08-05-phase2-frontend-core-design.md`, `docs/superpowers/specs/2026-09-06-phase3-foundation-design.md`).
**Scope boundary:** the second of six sub-projects decomposing "Phase 3 — כלי למידה מקומיים" (`site-build-docs/00-BUILD-README.md`, `03-FRONTEND-SPEC.md` §"פיצ'רים חדשים"). Covers spec item C (personal notes) only. Notes, flashcards/SRS, quiz, map, and command palette are the remaining four sub-projects.

## Goal

Let a user write a free-text personal note on any topic, in the reader, with automatic debounced saving — persisted locally (IndexedDB), working fully offline, with no visible save action required. Optionally include note text when searching the topic grid.

## Out of scope (later sub-projects / phases)

Flashcards/SM-2 spaced repetition, quiz mode, daily review, knowledge-graph map, command palette (later Phase 3 sub-projects) · Supabase sync (Phase 5) · PWA/offline app shell (Phase 4) · any visual indicator of "has a note" outside the reader (topic cards, sidebar) — reader-only surface, per spec §C, to keep this sub-project's scope tight.

## Data model

New type in `src/types.ts`:

```ts
export interface Note { topicId: string; text: string; updatedAt: number }
```

`topic.id` is the sole key (golden rule 2), same as `Progress`/`Favorite`/`Recent`. A new `notes` object store, keyed by `topicId`, added to the existing `kb-user-data` IndexedDB database via a version bump (1→2), using the `if (!db.objectStoreNames.contains(...))` guard pattern `db.ts`'s `upgrade()` was already structured for — v1 users upgrade with no data loss to their existing progress/favorites/recents stores.

Absence of a row means "no note." A note reduced to empty/whitespace-only text deletes its row rather than storing an empty string, matching the existing "absence = default state" convention — so `notes.has(topicId)` is always the correct "has a note" check with no separate empty-string edge case.

## Storage & state architecture

`src/lib/db.ts` gains `getAllNotes(): Promise<Note[]>` and `setNote(topicId: string, text: string): Promise<void>`. `setNote` deletes the row when `text.trim() === ''`, otherwise `put`s `{ topicId, text, updatedAt: Date.now() }` — a single idempotent write, same shape as `setFavorite`, with no read-then-write race. Same error contract as every other `db.ts` function: try/catch, `warnOnce`, safe default, never throws.

`src/store/userDataStore.ts` gains `notes: Map<string, string>` (populated in `loadUserData()`) and `setNote(topicId, text)` — updates the Map optimistically (deleting the key when `text.trim() === ''`), then fires `persistSetNote` unawaited. The action itself is not debounced; debouncing is a UI-layer concern (below), so a future direct caller of the store action still behaves correctly.

`src/store/uiStore.ts` gains `includeNotesInSearch: boolean` (default `false`) and `toggleIncludeNotesInSearch()`, reset to `false` in `clearFilters()`. This does not persist across reloads — it is session-only UI state, consistent with the rest of `uiStore`.

## UI integration

**`src/components/topic/TopicNotes.tsx`** (new): a labeled `<textarea>` (`<label htmlFor="topic-notes-{topicId}">ההערות שלי</label>`). Initial value comes from `useUserDataStore((s) => s.notes.get(topicId) ?? '')`; local `value` state holds every keystroke for zero-latency typing (same pattern as `SearchBar.tsx`'s `localValue`). On change, a 500ms debounce timer calls `setNote(topicId, value)`; the timer also flushes immediately on blur, and is cleared on unmount. No save-status indicator — autosave is silent, matching the spec's one-line description and the local-first philosophy that it always saves. `focus-visible`, ≥44px touch target on the textarea itself is not applicable (it's a multi-line field, sized by content), but the label association and full keyboard operability are required.

**`src/components/reader/TopicReader.tsx`**: render `<TopicNotes topicId={topic.id} />` after the main content block, before `<RelatedTopics />` — a personal-annotation section reads naturally as "yours, after the source material," separate from the status/favorite controls in the header.

**Search toggle:** a real `<input type="checkbox">` with a visible label "כלול הערות בחיפוש", placed in `src/pages/Home.tsx`'s existing search row immediately after `<SearchBar />`. Wired to `uiStore`'s `includeNotesInSearch`/`toggleIncludeNotesInSearch`.

**Filtering:** `src/lib/filterTopics.ts` gains an optional 5th parameter, `notes?: Map<string, string>`. When `filters.searchQuery` is non-empty and `notes` is provided, a topic also matches if `normalize(notes.get(topic.id) ?? '').includes(normalizedQuery)`, unioned into the existing `matchedIds` Set alongside the static-index match. Omitting the parameter preserves today's exact behavior — every existing call site and test keeps working unchanged. `Home.tsx` reads `notes` from `userDataStore` and passes it to `filterTopics` only when `includeNotesInSearch` is true (`includeNotesInSearch ? notes : undefined`), added to the surrounding `useMemo`'s dependency array.

No changes to `TopicCard`, `TopicListRow`, or `Sidebar` — reader-only surface.

## Testing

- `db.ts`: CRUD for the `notes` store, delete-on-empty-text behavior, failure-injection returns safe defaults (`getAllNotes` → `[]`, `setNote` swallows) and warns once.
- `userDataStore.ts`: `setNote` optimistic update including the delete-on-empty-text case removing the Map key; `loadUserData` populating `notes` including on injected db failure.
- `filterTopics.ts`: notes param omitted (unchanged-behavior regression guard), a note match the static index alone would miss, a topic matched by both the index and a note doesn't duplicate in the result.
- `TopicNotes.test.tsx` (new): typing debounces before `setNote` fires (fake timers), blur flushes immediately, unmount mid-debounce does not fire, initial value reflects an existing note, clearing to empty calls `setNote` with `''`.
- `TopicReader.test.tsx`: renders `TopicNotes` for the current topic.
- `Home.test.tsx` / `uiStore.test.tsx`: toggle flips `includeNotesInSearch` and resets on `clearFilters`; `Home` passes `notes` to `filterTopics` only when the toggle is on.
- Manual, not testable in jsdom: typing feels instant with no jank; reload preserves a saved note; the app still works with notes silently no-op'ing in a private/incognito window.

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- Manual check: a note survives reload; an emptied note removes its row (no orphaned blank entries); the "include notes" toggle finds a topic only its note text matches, alongside existing module/category/status filters.
- Light theme, dark theme, RTL, keyboard-only, mobile viewport all checked.
- No regressions to Phase 2 or Phase 3 sub-project #1 behavior (search/filter/sort/grid-list/reader/keyboard-nav/progress/favorites/recents).
- No hardcoded colors outside `--kb-*` tokens (golden rule 7).
