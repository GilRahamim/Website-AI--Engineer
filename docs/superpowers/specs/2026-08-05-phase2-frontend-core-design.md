# Phase 2 — Frontend Core: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** Phase 0 (scaffold) + Phase 1 (data migration) — both complete (`docs/superpowers/plans/2026-07-19-scaffold-and-data-migration.md`).
**Scope boundary:** matches "Phase 2 — Frontend ליבה" in `site-build-docs/00-BUILD-README.md`.

## Goal

Turn the current blank RTL/theme shell (`kb-app/src/App.tsx`) into the full browse-and-read experience: header, hero, sidebar navigation, search, multi-select filtering, sorting, grid/list views, and a topic reader — plus the P0 accessibility/depth fixes the spec calls out as previously missing. This is a read-only content experience: no user data (progress, favorites, notes, SRS) is introduced in this phase — that's Phase 3.

## In scope

- Sticky header: logo, two-line brand, theme toggle. **No PWA install button** — deferred to Phase 4 (manifest/service worker don't exist yet; a button with nothing to trigger would be dead UI).
- Hero: title, description, stat cards (topic/module counts).
- Sidebar: navigation by module + category, item counts, collapsed state, mobile drawer.
- Free-text search: Hebrew-normalized (reuses `src/lib/normalize.ts`), term highlighting.
- Multi-select filtering: modules and categories, OR within a filter type, AND across types. Active-filter chips with per-chip removal + "clear all".
- Accordion grouping: collapse/expand groups + "expand/collapse all", state held in the UI store.
- Sort: original order / A–Z (`localeCompare('he')`) / category.
- Grid view and compact list view, toggleable.
- Topic reader as a dedicated route (`/topic/:id`): breadcrumb, category badge, full content, related topics, formula images.
- Formula rendering: styled images, not KaTeX (see "Formula rendering reality check" below).
- Light/dark theme: system-preference sync + persisted override (already partly wired from Phase 0; this phase adds the toggle UI and confirms it against real content).
- Full keyboard navigation: arrow keys / `Enter` / `Home` / `End` across grid cards, plus existing shortcuts `/` (focus search), `Esc` (clear/close), `?` (shortcuts help).
- Shadow/depth system (`--kb-shadow-*` tokens already in `tokens.css`): hover-lift on cards, clear background→surface→card distinction in both themes.
- `focus-visible` on every interactive element (existing `--kb-focus-ring` token).

## Out of scope (later phases)

Progress tracking, favorites/recents, personal notes, flashcards/SRS, quiz mode, knowledge map, command palette (all Phase 3) · PWA/offline/install (Phase 4) · Supabase auth/sync (Phase 5) · deployment (Phase 6) · Playwright E2E (not assigned to any phase in the docs; picked up whenever E2E coverage becomes a priority).

## Formula rendering reality check

`03-FRONTEND-SPEC.md` and `01-ARCHITECTURE-AND-STACK.md` both call for lazy-loaded KaTeX rendering of formulas. Verified against the actual data: `topics.raw.json`'s `content_html` embeds formulas as base64 PNG images (matplotlib output — confirmed via PNG IHDR: colorType 6 / RGBA, i.e. transparent background, black line art), not LaTeX source. Phase 1's migration already extracted these to `/topic-assets/*.png` (`block-formula-img` / `cell-formula-img` classes in the split per-topic HTML). There is no LaTeX text anywhere in the 160 topics for KaTeX to render.

**Decision:** no KaTeX dependency in this phase. Formula images are treated as first-class content: styled for size/contrast, and — since they're black-on-transparent — given `filter: invert(1)` under `[data-theme="dark"]` so they stay legible without any image regeneration. Click-to-zoom is a nice-to-have if time allows within the task, not a hard requirement.

## Routing

React Router, two routes only:
- `/` — Home (browse: hero, sidebar, search/filter/sort, grid/list)
- `/topic/:id` — Reader (dedicated page, not a modal — deep-linkable, works with browser back/forward, matches the routes table in `03-FRONTEND-SPEC.md`)

`/flashcards`, `/quiz`, `/map`, `/settings` are **not** stubbed in this phase — each later phase adds its own route when it builds that feature, avoiding months of maintaining empty placeholder pages.

Topic ids contain `::` and spaces (e.g. `Intro to Data Science::algorithms::02_Linear_Regression.docx`), so the `:id` param is `encodeURIComponent`/`decodeURIComponent`'d at the route boundary.

## State management

One Zustand store, `src/store/uiStore.ts`, **session-only** (no persistence beyond what's noted below) — matches `01-ARCHITECTURE-AND-STACK.md`'s choice of Zustand for UI state and the local-first "full experience without an account" principle:

- `searchQuery: string`
- `selectedModules: Set<string>`
- `selectedCategories: Set<string>`
- `sortOrder: 'original' | 'alpha' | 'category'`
- `viewMode: 'grid' | 'list'`
- `sidebarCollapsed: boolean`
- `expandedGroups: Set<string>`
- theme is handled by the existing `lib/theme.ts` (light/dark, system-sync, **localStorage** — this one small preference is explicitly allowed by golden rule 4).

Because this is a module-level store rather than component state, filters/search/sort/view survive navigating to the reader and back with no extra plumbing — the Home page just re-mounts against the same store state. (Scroll-position restoration on back-navigation is not attempted in this phase — acceptable minor gap, not a regression since there's no scroll-restoring behavior today either.)

## Data flow

- `topics.clean.json`, `modules.json`, `search-index.json` are imported at build time — static, read-only, small enough to bundle directly (per architecture doc: content is never mutated at runtime).
- New pure function `src/lib/filterTopics.ts`: `(topics: Topic[], searchIndex: SearchEntry[], filters: FilterState) => Topic[]`. Unit-tested in isolation. Called via `useMemo` in `Home`, keyed on the relevant slice of store state. 160 items is small enough that no virtualization is needed; a light debounce on the search input is sufficient.
- Reader page: looks up the topic by `id` in the imported `topics.clean.json` array, then `fetch()`s `topic.contentPath` at runtime (lazy per-topic load, not bundled — consistent with the migration's per-topic split) and injects the HTML into a scoped container. This is our own generated, non-user-supplied HTML (course material extracted from trusted source docs), so `dangerouslySetInnerHTML` is used with no sanitization step — consistent with content being "sacred"/immutable per golden rule 1.
- `related_match` entries that are `null` (unresolved matches from migration) are filtered out before rendering `RelatedTopics`.

## Component tree

```
src/
├─ pages/
│  ├─ Home.tsx              — composes layout + browse; owns the filterTopics useMemo
│  └─ Reader.tsx             — topic lookup + content fetch + render
├─ components/
│  ├─ layout/
│  │  ├─ Header.tsx          — sticky, logo/brand, ThemeToggle
│  │  ├─ Hero.tsx            — title, description, stat cards
│  │  └─ Sidebar.tsx         — module/category nav w/ counts, collapse, mobile drawer
│  ├─ browse/
│  │  ├─ SearchBar.tsx
│  │  ├─ FilterChips.tsx     — active filters + "clear all"
│  │  ├─ SortMenu.tsx
│  │  ├─ ViewToggle.tsx      — grid/list
│  │  ├─ AccordionGroup.tsx  — per-module/category grouping, expand/collapse-all
│  │  ├─ TopicGrid.tsx / TopicCard.tsx
│  │  └─ TopicListRow.tsx
│  ├─ reader/
│  │  ├─ TopicReader.tsx     — breadcrumb, category badge, content, formula image styling
│  │  └─ RelatedTopics.tsx   — resolves related_match ids, skips nulls
│  └─ theme/ThemeToggle.tsx
├─ lib/
│  ├─ filterTopics.ts        — pure, unit-tested
│  └─ theme.ts                — get/set data-theme, system-preference sync, localStorage persist
├─ store/uiStore.ts
└─ hooks/useGridKeyboardNav.ts — arrow/Home/End/Enter across cards, shared by grid and list views
```

`pages/` composes screens only; `components/` is pure UI (no data-fetching logic beyond the Reader's own content fetch); `lib/` holds testable logic; `store/` holds UI state only — matches the responsibility split in `01-ARCHITECTURE-AND-STACK.md`.

## Accessibility (golden rule 6 — required, not optional)

- `:focus-visible` ring (`--kb-focus-ring` token) applied via one shared base style, not copy-pasted per component.
- Grid/list keyboard nav via the shared `useGridKeyboardNav` hook: arrow keys move focus between cards, `Enter` opens the topic, `Home`/`End` jump to first/last.
- Proper semantics: `nav`, `button`, `aria-expanded` on the accordion/sidebar-collapse/mobile-drawer, `aria-label` on icon-only controls (theme toggle, view toggle).
- `@media (prefers-reduced-motion: reduce)` disables the 160ms hover-lift/transition set.
- AA contrast checked in both themes, including the per-category hue chips.
- ≥44px touch targets on mobile.

## Testing

- Vitest + Testing Library (new devDependency) for:
  - `filterTopics.ts` — unit tests covering search+filter+sort combinations.
  - `useGridKeyboardNav` — unit tests for arrow/Home/End/Enter behavior.
  - Component tests: search narrows results, filter-chip removal updates the list, theme toggle flips `data-theme`, accordion expand/collapse, reader renders breadcrumb + related topics for a known fixture id.
- No Playwright in this phase (see "Out of scope").
- Manual verification required by `kb-app/CLAUDE.md`'s Definition of Done: light + dark, RTL, keyboard-only pass, mobile viewport (drawer, touch targets).

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- Every P0 fix from `03-FRONTEND-SPEC.md` present: shadow/hover-lift on cards, `focus-visible` everywhere, full grid keyboard nav, clear surface/card depth distinction in both themes.
- All 11 "existing features to restore" (`03-FRONTEND-SPEC.md` §"פיצ'רים קיימים לשחזר") working: header, hero, sidebar, search, multi-filter, accordion, sort, grid/list, reader, formula rendering (as images, per the decision above), theme switching.
- Manual check passes: light theme, dark theme, RTL, mobile viewport.
- No regressions vs. the current blank-shell baseline.
- No hardcoded colors outside `--kb-*` tokens (golden rule 7).
