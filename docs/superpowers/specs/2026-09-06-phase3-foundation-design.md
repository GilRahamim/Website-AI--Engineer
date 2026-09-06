# Phase 3, Sub-project #1 — Foundation + Progress + Favorites/Recents: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** Phase 2 (Frontend Core) — complete (`docs/superpowers/specs/2026-08-05-phase2-frontend-core-design.md`).
**Scope boundary:** the first of six sub-projects decomposing "Phase 3 — כלי למידה מקומיים" (`site-build-docs/00-BUILD-README.md`, `03-FRONTEND-SPEC.md` §"פיצ'רים חדשים"). Covers spec items A (progress tracking) and B (favorites + recently viewed), plus the shared IndexedDB user-data foundation the remaining sub-projects (notes, flashcards/SRS, quiz, knowledge map, command palette) will build on.

## Goal

Let a user mark a topic's learning status (not started / learning / mastered), star favorites, and see a "recently viewed" list — all persisted locally (IndexedDB), working fully offline/without an account, with progress reflected in the sidebar and hero, and integrated into the existing filter system. No backend sync (Phase 5) or other Phase 3 features (notes, SRS, quiz, map, command palette) are introduced here.

## Out of scope (later sub-projects / phases)

Personal notes, flashcards/SM-2 spaced repetition, quiz mode, daily review, knowledge-graph map, command palette (later Phase 3 sub-projects) · Supabase sync (Phase 5) · PWA/offline app shell (Phase 4, unrelated to this sub-project's own offline-capable data layer).

## Data model

New types in `src/types.ts`:

```ts
export type ProgressStatus = 'new' | 'learning' | 'mastered';
export interface Progress { topicId: string; status: ProgressStatus; updatedAt: number }
export interface Favorite { topicId: string; createdAt: number }
export interface Recent   { topicId: string; viewedAt: number }
```

`topic.id` is the sole key (golden rule 2) for every record. Three IndexedDB object stores in a new `kb-user-data` database (version 1), each keyed by `topicId`:
- `progress` — absence of a record means status `'new'`.
- `favorites` — one row per favorited topic.
- `recents` — one row per topic; re-viewing overwrites `viewedAt` rather than appending, so row count is naturally capped at the topic total (160) — no pruning logic needed. Reads return the top 12 by `viewedAt` desc.

The `upgrade()` callback is structured so later sub-projects can add `notes`/`srsCards` stores via a version bump without restructuring this code, and so Phase 5's sync layer can add metadata fields without a rewrite.

## Storage & state architecture

`src/lib/db.ts` wraps the `idb` package (new dependency — a ~1KB promise wrapper over IndexedDB, appropriately lightweight per `00-BUILD-README.md`'s "no unneeded heavy deps" principle) with plain async functions: `getAllProgress()`, `setProgress(topicId, status)`, `getAllFavorites()`, `toggleFavorite(topicId)`, `getAllRecents()`, `recordView(topicId)`. Every function catches its own IndexedDB errors, `console.warn`s once per session (never `console.error`, per the Definition of Done), and returns a safe default — this sub-project must keep working (in-memory only) even where IndexedDB is unavailable (e.g. private browsing), consistent with golden rule 3 (local-first, never block UI on storage).

`src/store/userDataStore.ts` is a Zustand store (same pattern as the existing `uiStore.ts`) acting as a write-through in-memory cache: `progress: Map<string, ProgressStatus>`, `favorites: Set<string>` (populated newest-first), `recents: {topicId, viewedAt}[]`, `isLoaded: boolean`, and actions `loadUserData()`, `setStatus`, `cycleStatus` (new→learning→mastered→new), `toggleFavorite`, `recordView`. Every mutating action updates state synchronously first (optimistic), then persists to `db.ts` fire-and-forget. `App.tsx` calls `loadUserData()` once on mount; components never block render on `isLoaded` — this mirrors the "optimistic write, in-memory source of truth" model `04-BACKEND-SUPABASE-SYNC.md` already specifies for the future sync layer, so Phase 5 slots in later without restructuring this state layer.

Rejected alternatives: on-demand per-component IndexedDB reads (causes loading flicker per card and needs a manual event bus to keep sidebar/reader in sync); React Context + `useReducer` (works the same as Zustand here but introduces a second state-management pattern alongside the existing `uiStore`, for no benefit).

## UI integration

**Card structure change (required):** `TopicCard.tsx` and `TopicListRow.tsx` are today a single `<Link>` element each with no wrapper. The new status/favorite `<button>`s cannot nest inside an `<a>` (invalid HTML, breaks assistive tech — conflicts with golden rule 6). **Resolution: restructure to the stretched-link pattern.** Outer `<div>` holds a header row (category chip + status pill + favorite star, as siblings, `z-index` above the overlay) and an inner `<Link>` wrapping the title/definition, expanded via a transparent `::after` covering the whole card so "click anywhere to open" is unchanged. `index.css`'s `.kb-topic-card:focus-visible` / `.kb-topic-list-row:focus-visible` move to `:has(a:focus-visible)`. This is a deliberate, in-scope change to two already-shipped components.

**Shared controls:** `src/components/topic/TopicStatusButton.tsx` and `TopicFavoriteButton.tsx` (new `topic/` folder — reused across TopicCard, TopicListRow, TopicReader with only a `size?: 'sm' | 'lg'` prop varying). Each reads/writes `userDataStore` directly (matches existing components subscribing straight to `uiStore`, e.g. `FilterChips.tsx`). Status pill cycles on click (glyphs ○/◐/●); favorite is a star toggle (outline/filled). Both: full `aria-label` (state + action), `aria-pressed` where applicable, `focus-visible`, ≥44px touch target, `preventDefault`/`stopPropagation` on click.

**TopicReader:** same two controls (`size="lg"`) near the breadcrumb/badge header. `Reader.tsx` calls `recordView(topic.id)` once per topic-id change (not from card hover/click — viewing means opening the reader).

**Sidebar:** two new collapsible `<nav>` sections, "מועדפים" and "נצפו לאחרונה", each linking straight to `/topic/:id`, hidden entirely when empty, resolving `topicId → Topic` defensively (skip unresolved ids silently, same pattern as `RelatedTopics.tsx`'s `related_match` handling). A slim progress bar (`aria-hidden`, paired with a visually-hidden text summary for screen readers) sits under each module's nav item, mastered-count vs. module topic count.

**Hero:** a third stat card, "שלטת ב-X מתוך 160", styled like the existing two.

**Filtering:** `FilterState` gains `selectedStatuses: Set<ProgressStatus>`; `uiStore` gains matching state + `toggleStatus` (same `toggleInSet` OR-within/AND-across pattern as modules/categories, included in `clearFilters`). `filterTopics` takes the live progress `Map` as an extra parameter and filters by resolved status (default `'new'`) — stays a pure function, no store import; `Home.tsx` passes `userDataStore`'s progress in. `FilterChips` gets matching removable chips. `Home.tsx` adds a row of 3 status-toggle buttons next to `SortMenu`/`ViewToggle`, same `aria-pressed` visual language as Sidebar's existing toggle buttons.

## Testing

- `fake-indexeddb` (new devDependency) registered once via `import 'fake-indexeddb/auto'` at the top of `src/setupTests.ts` (matches the existing single-global-setup-file convention).
- Unit tests: `db.ts` (CRUD per store, recents cap-at-12-on-read, failure-injection returns safe defaults + warns once), `userDataStore.ts` (each action, `cycleStatus` wraparound, optimistic-before-persist-settles, `loadUserData` incl. on injected failure), `filterTopics.ts` (new status-filter cases).
- Component tests: `TopicStatusButton`/`TopicFavoriteButton` (click behavior, aria state), `TopicCard`/`TopicListRow` (existing link/highlight/keyboard-nav assertions still pass against the restructured markup; clicking the new controls doesn't navigate), `Sidebar` (empty-state hiding, correct hrefs, unresolved ids skipped, progress bar values), `Hero` (stat card count), `FilterChips` (status chips).
- Manual, not testable in jsdom: whole card still fully clickable outside the two buttons (the stretched-link z-index behavior), in grid and list view, both themes, RTL.

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- Manual check: status cycles and persists across reload; favorite toggles and appears in Sidebar; viewing topics populates "recently viewed" (max 12, no dupes); per-module and overall progress bars update live; status filter chips work alongside existing module/category filters; whole card remains clickable outside the buttons; app still works with storage silently no-op'ing in a private/incognito window.
- Light theme, dark theme, RTL, keyboard-only, mobile viewport all checked.
- No regressions to Phase 2 behavior (search/filter/sort/grid-list/reader/keyboard-nav).
- No hardcoded colors outside `--kb-*` tokens (golden rule 7).
