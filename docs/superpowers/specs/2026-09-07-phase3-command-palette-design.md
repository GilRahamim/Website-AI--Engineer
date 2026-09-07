# Phase 3, Sub-project #6 — Command Palette: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** Phase 2 (Frontend Core) and Phase 3 sub-projects #1-#5 (Foundation/Progress/Favorites/Recents, Personal Notes, Flashcards + SRS + Daily Review, Quiz mode, Knowledge Graph map) — all complete and merged.
**Scope boundary:** the sixth and final sub-project decomposing "Phase 3 — כלי למידה מקומיים" (`site-build-docs/00-BUILD-README.md`, `03-FRONTEND-SPEC.md` §H). Completes Phase 3.

## Goal

Let a user press Cmd/Ctrl+K from anywhere in the app to open a quick-jump overlay: search any topic by name and navigate to it, or run a quick action (jump to a page, toggle theme) — all keyboard-driven. Along the way, extract the module/category filter-dropdown markup — now duplicated verbatim across `Flashcards.tsx`, `Quiz.tsx`, and `Map.tsx` — into a shared component, per sub-project #5's final review recommendation.

## Out of scope

Supabase sync (Phase 5) · PWA/offline app shell (Phase 4) · fuzzy/typo-tolerant matching (simple normalized-substring matching, same technique Home's search already uses) · a configurable/extensible action system for future features (the action list is a fixed, small set defined once; YAGNI until a real need for extensibility appears) · recent/frequently-used result ranking (every open starts from the same fixed action list; out of scope for a first version).

## Section 1: DRY refactor (this sub-project's first task)

`src/lib/categoryLabels.ts` (new, pure): `buildCategoryLabels(topics: Topic[]): Record<string, string>` — the exact `Object.fromEntries(topics.map((t) => [t.category, t.category_label]))` expression currently duplicated in `Home.tsx`, `Flashcards.tsx`, `Quiz.tsx`, and `Map.tsx`.

`src/components/browse/TopicFilters.tsx` (new): a small presentational component — props `modules`, `categoryLabels`, `selectedModule`, `selectedCategory`, `onModuleChange`, `onCategoryChange` — rendering exactly the module+category `<label>/<select>` pair currently copy-pasted byte-for-byte in `Flashcards.tsx`/`Quiz.tsx`/`Map.tsx`. Each page keeps its own additional controls (Flashcards' due-only checkbox, Quiz's question-count selector) — only the two controls identical across all three are extracted. `Flashcards.tsx`, `Quiz.tsx`, and `Map.tsx` are updated to use both; `Home.tsx`'s own filter UI (a different, multi-select Sidebar/FilterChips-based system, not this single-select pair) is untouched — it was never part of this duplication.

## Section 2: Command palette architecture

`src/lib/commandPalette.ts` (new, pure — no store, no React):

```ts
export interface PaletteAction { id: string; label: string }
```

`buildActionList(): PaletteAction[]` — five fixed entries (home, flashcards, quiz, map, toggle-theme), pure data with no callbacks attached at this layer.

`filterResults(query: string, actions: PaletteAction[], topics: Topic[]): { actions: PaletteAction[]; topics: Topic[] }` — normalizes the query via the existing `normalize()` (same Hebrew-aware normalization already used by Home's search). An empty query returns all actions and no topics (never showing an arbitrary slice of 160 topics unprompted). A non-empty query matches actions by label and topics by **title only** — per the spec's "search topic by name," not the full definition-text search index Home's search uses, keeping quick-jump results tight — with topic matches capped at 8.

**`src/components/palette/CommandPalette.tsx`** (new): mounted once in `App.tsx`, as a sibling of `<Routes>` (safe, since `App` already renders inside `main.tsx`'s `<BrowserRouter>`, so `useNavigate()` is available). Owns its own open/query/selected-index state; a `useEffect` on `window` captures **Cmd/Ctrl+K globally, including while a text field is focused** — unlike the app's existing bare `/`/`?` shortcuts, a modifier combo never collides with normal typing, so no "am I typing" guard is needed here. Renders nothing when closed. When open: a modal dialog matching `ShortcutsHelp.tsx`'s existing pattern (focus trap, `Esc` to close, focus restored to the previously-focused element on close) with a text input and a merged, keyboard-navigable result list (↑/↓ to move, Enter to activate — this app's established keyboard vocabulary). Selecting one of the four page actions calls `navigate(path)`; selecting "toggle theme" calls the existing `setTheme`/theme-reading functions from `src/lib/theme.ts` (the same ones `ThemeToggle` already uses); selecting a topic navigates to `/topic/:id`. Any selection closes the palette.

`ShortcutsHelp.tsx` gains one new line documenting Cmd/Ctrl+K — the natural place, same dialog, same audience.

## Testing

- `categoryLabels.ts` / `TopicFilters.tsx`: pure derivation test; component test (renders both selects, calls the right change handler, correct options from `modules`/`categoryLabels` props).
- `commandPalette.ts`: `filterResults` — empty query returns all actions/no topics; a query matching an action label; a query matching topic titles (normalized, Hebrew-aware); the 8-result cap; no crash on a query matching nothing.
- `CommandPalette.test.tsx` (new): closed by default; Cmd/Ctrl+K opens it from any simulated route, including while a text input is focused; typing narrows results; ↑/↓ + Enter selects; Escape closes and returns focus; selecting a page action navigates; selecting "toggle theme" flips the theme; selecting a topic navigates to its reader.
- Regression coverage for the refactor: `Flashcards.test.tsx`/`Quiz.test.tsx`/`Map.test.tsx`'s existing filter-behavior tests must still pass unchanged against the now-shared `TopicFilters` component, proving the extraction is behavior-preserving, not just a visual copy.
- Manual, not testable in jsdom: the palette visually renders atop every page correctly in RTL and both themes; a real Cmd (Mac) vs Ctrl (Windows/Linux) keybind check.

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- Manual check: Cmd/Ctrl+K opens the palette from Home, Reader, Flashcards, Quiz, and Map; typing narrows to matching actions/topics; every action and every topic result navigates correctly; theme toggle from the palette matches the existing `ThemeToggle` button's effect.
- No regressions to sub-projects #1-#5 — the pass that finally proves the shared `TopicFilters` extraction didn't break Flashcards/Quiz/Map.
- Light theme, dark theme, RTL, keyboard-only all checked.
- No hardcoded colors outside `--kb-*` tokens (golden rule 7).
