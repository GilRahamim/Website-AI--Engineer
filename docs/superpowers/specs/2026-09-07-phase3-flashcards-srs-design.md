# Phase 3, Sub-project #3 — Flashcards + Spaced Repetition + Daily Review: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** Phase 2 (Frontend Core) and Phase 3 sub-projects #1-#2 (Foundation/Progress/Favorites/Recents, Personal Notes) — all complete and merged (`docs/superpowers/specs/2026-08-05-phase2-frontend-core-design.md`, `docs/superpowers/specs/2026-09-06-phase3-foundation-design.md`, `docs/superpowers/specs/2026-09-06-phase3-notes-design.md`).
**Scope boundary:** the third of six sub-projects decomposing "Phase 3 — כלי למידה מקומיים" (`site-build-docs/00-BUILD-README.md`, `03-FRONTEND-SPEC.md` §§D, F). Covers spec item D (Flashcards + Spaced Repetition) and item F (Daily Review). Quiz mode, the knowledge-graph map, and the command palette are the remaining three sub-projects.

## Goal

Let a user study any topic as a flashcard (see the title, recall, reveal the definition, rate their recall), with a simplified SM-2 spaced-repetition schedule persisted locally, plus a "today to learn" summary on the home page — all working fully offline, no backend.

## Out of scope (later sub-projects / phases)

Quiz mode, knowledge-graph map, command palette (later Phase 3 sub-projects) · Supabase sync (Phase 5) · PWA/offline app shell (Phase 4) · any coupling between SRS grading and the `progress` status from sub-project #1 (they are deliberately independent systems — grading a flashcard never changes a topic's manual learning-status) · an explicit "add to flashcards" step (every topic is an implicit, always-eligible card) · same-session requeue of "Again"-rated cards (they leave today's session and reappear on a future day, matching the schema's day-granularity `intervalDays`).

## Data model & algorithm

New types in `src/types.ts`:

```ts
export interface SrsCard {
  topicId: string;
  ease: number;         // SM-2 ease factor, starts at 2.5
  intervalDays: number; // current interval, starts at 0 (never reviewed)
  dueAt: number;        // timestamp; absence of a record = due now
  reps: number;
  lapses: number;
  updatedAt: number;
}
export type SrsRating = 'again' | 'hard' | 'good' | 'easy';
```

`topic.id` is the sole key (golden rule 2), same as `Progress`/`Favorite`/`Recent`/`Note`. A new `srsCards` object store, keyed by `topicId`, is added to the existing `kb-user-data` IndexedDB database via a version bump (2→3), using the same `if (!db.objectStoreNames.contains(...))` guard pattern already in `db.ts`'s `upgrade()` — v1/v2 users upgrade with no data loss to their existing stores.

Absence of a record means "never reviewed" — and, per the explicit decision to treat new cards as immediately due (matching Anki's default and this app's existing "absence = default/actionable state" convention for progress), a missing record is *due now*, not due later.

`src/lib/srs.ts` (new, pure — no store or IndexedDB import, matching the existing `filterTopics.ts`/`progressStatus.ts` pattern of pure logic the store is the sole caller of):
- `isDue(card: SrsCard | undefined, now: number): boolean` — `true` when `card` is `undefined` or `card.dueAt <= now`.
- `gradeCard(card: SrsCard | undefined, rating: SrsRating, now: number): SrsCard` — Anki's simplified SM-2. A missing card starts from `{ease: 2.5, intervalDays: 0, reps: 0, lapses: 0}` before applying the rating:
  - **Again:** `intervalDays = 1`, `ease = max(1.3, ease - 0.2)`, `lapses += 1`.
  - **Hard:** `intervalDays = max(1, round(intervalDays * 1.2))`, `ease = max(1.3, ease - 0.15)`.
  - **Good:** `intervalDays = max(1, round(intervalDays * ease))`.
  - **Easy:** `intervalDays = max(1, round(intervalDays * ease * 1.3))`, `ease = ease + 0.15`.
  - Every rating: `reps += 1`, `dueAt = now + intervalDays * 86400000`, `updatedAt = now`.
- `getDueTopicIds(topics: Topic[], srsCards: Map<string, SrsCard>, now: number): string[]` — the single definition of "what's due," filtering the real topic list against `isDue`, used by both the Flashcards page and Home's Daily Review card so they can never disagree.

`db.ts` gains `getAllSrsCards(): Promise<SrsCard[]>` and `setSrsCard(topicId: string, card: SrsCard): Promise<void>` — same try/catch/`warnOnce`-once-per-session/safe-default contract as every other function in the file; never throws, local-first.

## Storage & state architecture

`userDataStore.ts` gains `srsCards: Map<string, SrsCard>` (populated in `loadUserData()` from `getAllSrsCards()`) and one action, `gradeCard(topicId: string, rating: SrsRating)` — computes the new card via `srs.gradeCard(current, rating, Date.now())`, updates the Map optimistically, then persists via `setSrsCard` fire-and-forget. Same write-through shape as every existing action in this store.

No new `uiStore` state: the Flashcards page's module/category/status/due-only filters are **page-local React state**, not global `uiStore` state — a deliberate choice so that a filter left on while browsing Home never silently shrinks today's study deck, and vice versa. The page still reuses the existing `filterTopics` function (passing its own local filter state) and `getDueTopicIds`.

## UI integration

**Routing:** `App.tsx` gains `<Route path="/flashcards" element={<Flashcards />} />`.

**`Header.tsx`:** gains a persistent nav link, "כרטיסיות", to `/flashcards` — visible on every page (unlike `Sidebar`, which only renders on Home) — with a small due-count badge (the spec's optional badge) computed via `getDueTopicIds`, hidden when the count is 0.

**`src/pages/Flashcards.tsx`** (new): page-local filter state (module select, category select, status select, and a due-only/all-cards toggle defaulting to due-only) builds today's queue by running `filterTopics` then `getDueTopicIds` (when due-only) or just `filterTopics` (when "all"), shuffled once when a session starts. One card is shown at a time:
- Front: the topic's title, with a "לחץ לחשיפה" reveal control (click, or Space/Enter).
- Back (after reveal): the topic's `definition`, a "פתח את הנושא המלא" link to the full reader (`/topic/:id`), and four rating buttons — שוב/קשה/טוב/קל (Again/Hard/Good/Easy) — also bound to keys 1-4, matching this app's existing keyboard-shortcuts culture (`ShortcutsHelp`).
- Rating calls `gradeCard(topicId, rating)` and advances to the next card in the shuffled queue; an "Again"-rated card is not reinserted this session (it already has a future `dueAt`).
- Empty-queue state ("אין כרטיסים לחזרה") when the filtered queue starts empty, and an end-of-session state ("סיימת! X כרטיסים נסקרו") once the queue is exhausted.

**Home's Daily Review card:** a new small card, styled like `Hero`'s existing stat cards, sitting alongside them. Shows "X ממתינים היום" (`getDueTopicIds(topics, srsCards, Date.now()).length`), a "התחל חזרה" button linking to `/flashcards` (opens due-only by default — no query param needed to communicate this), and "מושג אקראי" linking to one topic chosen at random on render, as a low-friction discovery nudge.

## Testing

- `srs.ts`: `isDue` (no record, past-due, future-due), `gradeCard` for all four ratings including the very first review of a topic and the ease floor (1.3) holding under repeated Again/Hard, `getDueTopicIds` against a mix of due/not-due/never-reviewed topics.
- `db.ts`: CRUD for `srsCards`, failure-injection returns safe defaults and warns once, the v2→v3 upgrade guard preserves existing stores.
- `userDataStore.ts`: `gradeCard`'s optimistic update and persistence call, `loadUserData` populating `srsCards` including on injected failure.
- `Flashcards.test.tsx` (new): changing a filter rebuilds the queue; reveal shows the definition and the full-reader link; each rating button advances to the next card and calls the store's `gradeCard` with the correct rating; keyboard shortcuts (reveal, 1-4 to rate) work; empty-queue and end-of-session states render correctly.
- `Header.test.tsx`: due-count badge appears with the right number and is hidden at zero.
- `Home.test.tsx` additions: Daily Review card shows the correct due count and its random-concept link resolves to a real topic.
- Manual, not testable in jsdom: a full keyboard-only review session end to end; light theme, dark theme, RTL on the new page.

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- Manual check: grading a card updates its due date and it no longer appears in today's queue; module/category/status/due-only filters narrow the deck correctly; the Daily Review card's due count matches the Flashcards page's due-only queue size; a brand-new (never-visited) install shows all 160 topics as due.
- Light theme, dark theme, RTL, keyboard-only, mobile viewport all checked.
- No regressions to Phase 2 or Phase 3 sub-projects #1-#2 behavior (search/filter/sort/grid-list/reader/keyboard-nav/progress/favorites/recents/notes).
- No hardcoded colors outside `--kb-*` tokens (golden rule 7).
