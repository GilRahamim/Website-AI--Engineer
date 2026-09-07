# Phase 3, Sub-project #5 — Knowledge Graph Map: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** Phase 2 (Frontend Core) and Phase 3 sub-projects #1-#4 (Foundation/Progress/Favorites/Recents, Personal Notes, Flashcards + SRS + Daily Review, Quiz mode) — all complete and merged. This sub-project does not build on any of their user-data state; it only relies on the static topic dataset and the page-local-filter convention those sub-projects established.
**Scope boundary:** the fifth of six sub-projects decomposing "Phase 3 — כלי למידה מקומיים" (`site-build-docs/00-BUILD-README.md`, `03-FRONTEND-SPEC.md` §G). The command palette is the remaining sub-project.

## Goal

Let a user explore topics as an interactive force-directed graph — concepts as nodes, `related_match` as edges — filterable by module/category, where clicking a node opens that topic's reader. Useful for associative, non-linear navigation of the 160-topic dataset.

## Out of scope (later sub-projects / phases)

Command palette (the remaining Phase 3 sub-project) · Supabase sync (Phase 5) · PWA/offline app shell (Phase 4) · any encoding of `userDataStore` state on the graph (progress/favorites/SRS status as node styling) — this sub-project is a pure exploration/navigation tool over the static dataset, not an extension of the learning-progress features · a due-only or status filter (no user-data dependency, per above).

## Data & graph construction

No new stored data — the graph is derived at render time from the existing `topics.clean.json`.

`src/lib/graph.ts` (new, pure — no store import):

```ts
export interface GraphNode {
  id: string;
  title: string;
  category: Category;
}
export interface GraphLink {
  source: string;
  target: string;
}
```

`buildGraphData(topics: Topic[], selectedModule: string | 'all', selectedCategory: string | 'all'): { nodes: GraphNode[]; links: GraphLink[] }`:
- Filters `topics` by module/category (`'all'` = no restriction, matching the sentinel convention `Flashcards.tsx`/`Quiz.tsx` already use), producing `nodes`.
- Builds `links` from each remaining topic's `related_match`, but only when **both** endpoints are in the filtered node set — an edge to a hidden topic is silently dropped, not shown dangling.
- De-duplicates: `related_match` is not guaranteed symmetric (A→B and B→A can both appear as separate entries across the dataset — verified: 471 non-null entries, 22 null/unresolved already excluded during the original data migration, no dangling ids), so the same unordered pair produces exactly one `GraphLink`, not two overlapping ones.

## Visualization & UI

**Library:** `react-force-graph-2d` (the lightweight 2D-only variant — not the full `react-force-graph`, which bundles three.js for unused 3D/VR rendering). Canvas-based, with pan/zoom/drag-to-reposition and node-click/hover events built in, requiring no custom rendering code.

**Routing:** `App.tsx` gains `<Route path="/map" element={<Map />} />`. `Header.tsx` gains a third persistent nav link, "מפה", alongside the existing "כרטיסיות"/"מבחן" links — no badge. This page never reads `userDataStore`, so it carries none of the async-hydration hazard the other Phase 3 pages had to design around.

**Color resolution:** the canvas can't use `var(--kb-cat-*)` directly — a canvas 2D context doesn't participate in the CSS cascade. `Map.tsx` resolves the five category tokens to real color strings via `getComputedStyle(document.documentElement)`, once at mount (a `useState` lazy initializer — a synchronous DOM read, not the kind of non-deterministic call `react-hooks/purity` restricts) and again whenever the theme changes. Since nothing today announces a theme change outside `ThemeToggle`'s own local state, `src/lib/theme.ts`'s `setTheme()` gains one line — `window.dispatchEvent(new Event('kb-theme-change'))` — and `Map.tsx` listens for it to re-resolve. This keeps `tokens.css` the single source of truth for these colors rather than duplicating values in JS, and is the only change to a file outside this sub-project's own new files.

**`src/pages/Map.tsx`** (new): module/category filter dropdowns (page-local state, `'all'`-sentinel, same pattern as `Flashcards.tsx`/`Quiz.tsx`) above a full-width `<ForceGraph2D>` built from `buildGraphData(topics, selectedModule, selectedCategory)`. Nodes colored by category using the resolved tokens; a topic's title shown as a hover tooltip (the library's built-in `nodeLabel`); hovering a node highlights its directly-connected edges (a `hoveredNodeId` state feeding `linkColor`/`nodeColor` callbacks); clicking a node navigates to `/topic/:id`.

## Testing

`react-force-graph-2d` renders to a real `<canvas>`, backed by browser APIs jsdom doesn't meaningfully implement — tests mock the library with a small test double that renders `graphData`'s node/link counts as text and exposes `onNodeClick`/`onNodeHover` as testable hooks, so this app's integration code (filtering → `buildGraphData` → props → navigation) is verified without needing canvas internals.

- `graph.ts`: `buildGraphData` — filters by module/category including `'all'`, deduplicates a symmetric A↔B pair into one edge, drops an edge when either endpoint is filtered out, handles a topic with zero related topics.
- `theme.test.ts` addition: `setTheme` dispatches a `kb-theme-change` window event.
- `Map.test.tsx` (new, mocked graph library): filters narrow the rendered node/link counts; clicking a (mocked) node navigates to `/topic/:id`; category colors are resolved from `getComputedStyle` at mount and re-resolved on a `kb-theme-change` event.
- `Header.test.tsx` addition: renders a link to `/map`.
- Manual, not testable in jsdom: the actual force-directed layout renders and is legible; pan/zoom/drag-to-reposition feel right; the hover tooltip and neighbor-highlighting work; category colors are correct and readable in both themes; RTL layout.

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green — a successful build confirms the new dependency doesn't break anything; the existing >500kB chunk-size advisory is expected to grow further and remains non-blocking, consistent with prior sub-projects.
- Manual check: graph renders all 160 topics by default; module/category filters narrow it correctly with no dangling edges; clicking a node opens that topic's reader; colors are legible in both themes.
- Light theme, dark theme, RTL all checked.
- No regressions to Phase 2 or Phase 3 sub-projects #1-#4.
- No hardcoded colors outside `--kb-*` tokens (resolved dynamically at render time, never duplicated as literal values in JS).
