# Phase 3, Sub-project #5 — Knowledge Graph Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user explore topics as an interactive force-directed graph — concepts as nodes, `related_match` as edges — filterable by module/category, with a click on any node opening its reader.

**Architecture:** A pure `src/lib/graph.ts` derives filtered, deduplicated graph data from the existing static topic dataset (no new storage, no `userDataStore` involvement); a new `Map` page renders it via `react-force-graph-2d`, resolving `--kb-cat-*` category colors from the DOM at mount and on theme change (canvas rendering can't read CSS custom properties directly); `Header` gains a third nav link.

**Tech Stack:** React 19, TypeScript, `react-force-graph-2d` (new dependency), `react-router-dom`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-07-phase3-knowledge-map-design.md`

## Global Constraints

- `src/lib/graph.ts` is pure: no store import, no DOM access.
- An edge is dropped when either endpoint is filtered out — never shown dangling.
- A symmetric A↔B relationship (both directions present in the raw `related_match` data) produces exactly one `GraphLink`, not two.
- This sub-project introduces no dependency on `userDataStore` — the `Map` page never reads progress/favorites/notes/SRS state, so it carries none of the async-hydration hazard other Phase 3 pages had to design around.
- Canvas rendering cannot use `var(--kb-cat-*)` directly — colors must be resolved via `getComputedStyle(document.documentElement)` at mount and re-resolved on a `kb-theme-change` window event (a new one-line addition to `src/lib/theme.ts`'s `setTheme`), never hardcoded or duplicated as literal values in JS.
- RTL, both themes, `--kb-*` tokens only apply to every new UI element.
- `react-force-graph-2d`'s shipped type definitions (verified against version 1.29.1, the version this plan pins) export `NodeObject<NodeType>` and `LinkObject<NodeType, LinkType>` alongside the default component — use these exact types as shown in this plan's code. If the installed version's types differ, adapt the callback parameter types to match and document the deviation in your report; do not silently redesign the approach.

---

## Task 1: `src/lib/graph.ts` — pure graph construction

**Files:**
- Create: `kb-app/src/lib/graph.ts`
- Test: `kb-app/src/lib/graph.test.ts`

**Interfaces:**
- Produces: `GraphNode { id: string; title: string; category: Category }`, `GraphLink { source: string; target: string }`, `GraphData { nodes: GraphNode[]; links: GraphLink[] }`, `buildGraphData(topics: Topic[], selectedModule: string | 'all', selectedCategory: string | 'all'): GraphData`.

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/lib/graph.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildGraphData } from './graph';
import type { Topic } from '../types';

function topic(overrides: Partial<Topic>): Topic {
  return {
    id: 'id',
    module: 'm',
    module_label: 'M',
    category: 'concepts',
    category_label: 'C',
    num: 1,
    slug_name: 'slug',
    title: 'Title',
    definition: 'Definition',
    related_raw: [],
    related_match: [],
    contentPath: '/x.html',
    ...overrides,
  };
}

const topics: Topic[] = [
  topic({ id: 'a', module: 'm1', category: 'concepts', title: 'A', related_match: ['b', 'c'] }),
  topic({ id: 'b', module: 'm1', category: 'algorithms', title: 'B', related_match: ['a'] }),
  topic({ id: 'c', module: 'm2', category: 'concepts', title: 'C', related_match: ['a', null] }),
  topic({ id: 'd', module: 'm2', category: 'metrics', title: 'D', related_match: [] }),
];

describe('buildGraphData', () => {
  it('includes all topics as nodes when no filter is applied', () => {
    const { nodes } = buildGraphData(topics, 'all', 'all');
    expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('filters nodes by module', () => {
    const { nodes } = buildGraphData(topics, 'm1', 'all');
    expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('filters nodes by category', () => {
    const { nodes } = buildGraphData(topics, 'all', 'concepts');
    expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'c']);
  });

  it('deduplicates a symmetric A<->B relationship into one link', () => {
    const { links } = buildGraphData(topics, 'all', 'all');
    const abLinks = links.filter(
      (l) => (l.source === 'a' && l.target === 'b') || (l.source === 'b' && l.target === 'a'),
    );
    expect(abLinks).toHaveLength(1);
  });

  it('drops a link when the related topic is filtered out', () => {
    const { links } = buildGraphData(topics, 'm1', 'all'); // only a, b visible
    const acLinks = links.filter(
      (l) => (l.source === 'a' && l.target === 'c') || (l.source === 'c' && l.target === 'a'),
    );
    expect(acLinks).toHaveLength(0);
  });

  it('ignores null entries in related_match', () => {
    const { links } = buildGraphData(topics, 'all', 'all');
    expect(links.every((l) => l.source !== null && l.target !== null)).toBe(true);
  });

  it('produces zero links for a topic with no related topics', () => {
    const { links } = buildGraphData([topics[3]], 'all', 'all');
    expect(links).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- graph.test.ts`
Expected: FAIL — `./graph` does not exist.

- [ ] **Step 3: Implement `graph.ts`**

Create `kb-app/src/lib/graph.ts`:

```ts
import type { Category, Topic } from '../types';

export interface GraphNode {
  id: string;
  title: string;
  category: Category;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function buildGraphData(
  topics: Topic[],
  selectedModule: string | 'all',
  selectedCategory: string | 'all',
): GraphData {
  let filtered = topics;
  if (selectedModule !== 'all') filtered = filtered.filter((t) => t.module === selectedModule);
  if (selectedCategory !== 'all') filtered = filtered.filter((t) => t.category === selectedCategory);

  const visibleIds = new Set(filtered.map((t) => t.id));
  const nodes: GraphNode[] = filtered.map((t) => ({ id: t.id, title: t.title, category: t.category }));

  const seenPairs = new Set<string>();
  const links: GraphLink[] = [];
  for (const t of filtered) {
    for (const relatedId of t.related_match) {
      if (!relatedId || relatedId === t.id || !visibleIds.has(relatedId)) continue;
      const pairKey = [t.id, relatedId].sort().join('|');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      links.push({ source: t.id, target: relatedId });
    }
  }

  return { nodes, links };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- graph.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd kb-app
git add src/lib/graph.ts src/lib/graph.test.ts
git commit -m "feat: add pure knowledge-graph data construction (filter, dedupe edges)"
```

---

## Task 2: `Header` — Map nav link

**Files:**
- Modify: `kb-app/src/components/layout/Header.tsx`
- Modify: `kb-app/src/components/layout/Header.test.tsx`

**Interfaces:**
- Produces: a persistent `<Link to="/map">` in `Header`, no badge.

- [ ] **Step 1: Write the failing test**

In `kb-app/src/components/layout/Header.test.tsx`, add a new test (anywhere after the existing "renders a link to the Quiz page" test):

```tsx
  it('renders a link to the Map page', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: 'מפה' })).toHaveAttribute('href', '/map');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kb-app && npm run test -- Header.test.tsx`
Expected: FAIL — no link named "מפה".

- [ ] **Step 3: Add the nav link**

In `kb-app/src/components/layout/Header.tsx`, add a third `<Link>` right after the existing `/quiz` one (still inside the same `<div className="flex items-center gap-3">`, before `<ThemeToggle />`):

```tsx
        <Link
          to="/map"
          className="flex min-h-11 items-center rounded-md px-3 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
        >
          מפה
        </Link>
```

No other change to the file.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd kb-app && npm run test -- Header.test.tsx`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd kb-app
git add src/components/layout/Header.tsx src/components/layout/Header.test.tsx
git commit -m "feat: add Map nav link to Header"
```

---

## Task 3: `Map` page + routing

**Files:**
- Create: `kb-app/src/pages/Map.tsx`
- Create: `kb-app/src/pages/Map.test.tsx`
- Modify: `kb-app/src/lib/theme.ts`
- Modify: `kb-app/src/lib/theme.test.ts`
- Modify: `kb-app/src/App.tsx`
- Modify: `kb-app/src/App.test.tsx`
- Modify: `kb-app/package.json` (new dependency)

**Interfaces:**
- Consumes: `buildGraphData`, `GraphNode`, `GraphLink` from `../lib/graph` (Task 1).
- Produces: `Map` default export, mounted at route `/map`; `setTheme` (existing, in `../lib/theme`) now also dispatches a `kb-theme-change` window event.

This is the final task — Step 8 below is the full-suite verification gate.

- [ ] **Step 1: Install the dependency**

```bash
cd kb-app
npm install react-force-graph-2d@1.29.1
```

- [ ] **Step 2: Write the failing test for `theme.ts`'s event dispatch**

In `kb-app/src/lib/theme.test.ts`, add a new test inside `describe('theme', ...)` (anywhere after the existing `setTheme` test):

```ts
  it('setTheme dispatches a kb-theme-change window event', () => {
    const handler = vi.fn();
    window.addEventListener('kb-theme-change', handler);
    setTheme('dark');
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('kb-theme-change', handler);
  });
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd kb-app && npm run test -- theme.test.ts`
Expected: FAIL — the event is never dispatched.

- [ ] **Step 4: Add the event dispatch to `setTheme`**

In `kb-app/src/lib/theme.ts`, change:

```ts
export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}
```

to:

```ts
export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event('kb-theme-change'));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd kb-app && npm run test -- theme.test.ts`
Expected: PASS, all tests including the new one.

- [ ] **Step 6: Write the failing `Map.tsx` tests**

Create `kb-app/src/pages/Map.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Map from './Map';
import topicsData from '../data/topics.clean.json';
import type { GraphLink, GraphNode } from '../lib/graph';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

interface MockForceGraphProps {
  graphData: { nodes: GraphNode[]; links: GraphLink[] };
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
}

// react-force-graph-2d renders to a real <canvas>, which jsdom doesn't
// meaningfully implement. This test double stands in for it, exposing
// graphData's node/link counts as text and onNodeClick/onNodeHover as
// clickable/hoverable hooks — testing this app's integration code, not
// the library's canvas internals.
vi.mock('react-force-graph-2d', () => ({
  default: ({ graphData, onNodeClick, onNodeHover }: MockForceGraphProps) => (
    <div>
      <p>{`nodes:${graphData.nodes.length}`}</p>
      <p>{`links:${graphData.links.length}`}</p>
      {graphData.nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={() => onNodeClick?.(node)}
          onMouseEnter={() => onNodeHover?.(node)}
          onMouseLeave={() => onNodeHover?.(null)}
        >
          {node.title}
        </button>
      ))}
    </div>
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <Map />
    </MemoryRouter>,
  );
}

describe('Map', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders all 160 topics as nodes by default', () => {
    renderPage();
    expect(screen.getByText(`nodes:${topicsData.length}`)).toBeInTheDocument();
  });

  it('narrows the node count when a module filter is chosen', async () => {
    const user = userEvent.setup();
    renderPage();
    const moduleCount = topicsData.filter((t) => t.module === topicsData[0].module).length;

    await user.selectOptions(screen.getByLabelText('מודול'), topicsData[0].module);
    expect(screen.getByText(`nodes:${moduleCount}`)).toBeInTheDocument();
  });

  it('narrows the node count when a category filter is chosen', async () => {
    const user = userEvent.setup();
    renderPage();
    const categoryCount = topicsData.filter((t) => t.category === topicsData[0].category).length;

    await user.selectOptions(screen.getByLabelText('קטגוריה'), topicsData[0].category);
    expect(screen.getByText(`nodes:${categoryCount}`)).toBeInTheDocument();
  });

  it('clicking a node navigates to its reader page', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: topicsData[0].title }));
    expect(mockNavigate).toHaveBeenCalledWith(`/topic/${encodeURIComponent(topicsData[0].id)}`);
  });

  it('resolves category colors from getComputedStyle on mount', () => {
    const getPropertySpy = vi.spyOn(CSSStyleDeclaration.prototype, 'getPropertyValue');
    renderPage();
    expect(getPropertySpy).toHaveBeenCalledWith('--kb-cat-algorithms');
    getPropertySpy.mockRestore();
  });

  it('re-resolves colors when a kb-theme-change event fires', () => {
    renderPage();
    const getPropertySpy = vi.spyOn(CSSStyleDeclaration.prototype, 'getPropertyValue');
    window.dispatchEvent(new Event('kb-theme-change'));
    expect(getPropertySpy).toHaveBeenCalledWith('--kb-cat-algorithms');
    getPropertySpy.mockRestore();
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- Map.test.tsx`
Expected: FAIL — `./Map` does not exist.

- [ ] **Step 8: Implement `Map.tsx`**

Create `kb-app/src/pages/Map.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import type { ModulesMap, Topic } from '../types';
import { buildGraphData, type GraphLink, type GraphNode } from '../lib/graph';
import Header from '../components/layout/Header';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const categoryLabels: Record<string, string> = Object.fromEntries(
  topics.map((t) => [t.category, t.category_label]),
);

const CATEGORY_TOKEN_VARS: Record<string, string> = {
  algorithms: '--kb-cat-algorithms',
  concepts: '--kb-cat-concepts',
  metrics: '--kb-cat-metrics',
  formulas: '--kb-cat-formulas',
  architectures: '--kb-cat-architectures',
};

function resolveToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function resolveCategoryColors(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(CATEGORY_TOKEN_VARS).map(([category, cssVar]) => [category, resolveToken(cssVar)]),
  );
}

// d3-force (which react-force-graph-2d wraps) mutates link.source/target in
// place once the simulation initializes, replacing the plain id string with
// a reference to the resolved node object — so a link endpoint must be read
// through this helper, not compared to an id string directly, or the hover
// highlight would silently stop matching after the first simulation tick.
function linkEndpointId(endpoint: string | number | NodeObject<GraphNode>): string {
  return typeof endpoint === 'object' ? String(endpoint.id) : String(endpoint);
}

export default function Map() {
  const navigate = useNavigate();
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const [categoryColors, setCategoryColors] = useState(resolveCategoryColors);
  const [linkColor, setLinkColor] = useState(() => resolveToken('--kb-border-strong'));
  const [accentColor, setAccentColor] = useState(() => resolveToken('--kb-accent'));

  useEffect(() => {
    function handleThemeChange() {
      setCategoryColors(resolveCategoryColors());
      setLinkColor(resolveToken('--kb-border-strong'));
      setAccentColor(resolveToken('--kb-accent'));
    }
    window.addEventListener('kb-theme-change', handleThemeChange);
    return () => window.removeEventListener('kb-theme-change', handleThemeChange);
  }, []);

  const { nodes, links } = buildGraphData(topics, selectedModule, selectedCategory);

  return (
    <>
      <Header />
      <main className="flex flex-col p-4">
        <h1 className="mb-4 text-xl font-bold text-[var(--kb-text)]">מפת ידע</h1>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex flex-col text-sm text-[var(--kb-text)]">
            מודול
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
            >
              <option value="all">הכול</option>
              {Object.entries(modules).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm text-[var(--kb-text)]">
            קטגוריה
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
            >
              <option value="all">הכול</option>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-[var(--kb-muted)]">{`${nodes.length} נושאים, ${links.length} קשרים`}</p>
        </div>
        <div className="h-[70vh] overflow-hidden rounded-xl border border-[var(--kb-border)]">
          <ForceGraph2D<GraphNode, GraphLink>
            graphData={{ nodes, links }}
            nodeId="id"
            nodeLabel="title"
            nodeColor={(node: NodeObject<GraphNode>) => categoryColors[node.category] ?? linkColor}
            linkColor={(link: LinkObject<GraphNode, GraphLink>) => {
              if (!hoveredNodeId) return linkColor;
              const sourceId = link.source !== undefined ? linkEndpointId(link.source) : undefined;
              const targetId = link.target !== undefined ? linkEndpointId(link.target) : undefined;
              return sourceId === hoveredNodeId || targetId === hoveredNodeId ? accentColor : linkColor;
            }}
            onNodeClick={(node: NodeObject<GraphNode>) => {
              if (node.id) navigate(`/topic/${encodeURIComponent(String(node.id))}`);
            }}
            onNodeHover={(node: NodeObject<GraphNode> | null) => setHoveredNodeId(node ? String(node.id) : null)}
          />
        </div>
      </main>
    </>
  );
}
```

If the installed `react-force-graph-2d`'s shipped types differ from `NodeObject`/`LinkObject` as used here (this plan was written against version 1.29.1's actual `.d.ts`), adapt the callback parameter types to match what TypeScript reports and note the difference in your report — do not change the component's runtime behavior to work around a type mismatch.

- [ ] **Step 9: Wire the route in `App.tsx`**

In `kb-app/src/App.tsx`, add the import and route (leave the existing `/flashcards` and `/quiz` routes and their comments untouched):

```tsx
import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';
import Flashcards from './pages/Flashcards';
import Quiz from './pages/Quiz';
import Map from './pages/Map';
import { useUserDataStore } from './store/userDataStore';

export default function App() {
  const isLoaded = useUserDataStore((s) => s.isLoaded);

  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/topic/:id" element={<Reader />} />
      {/* Flashcards' initial session queue is built once via a useState lazy
          initializer that reads userDataStore synchronously at first render
          — before loadUserData() has necessarily resolved. Keying on
          isLoaded forces a remount the moment hydration completes, so the
          lazy initializer re-runs against the now-correct data instead of
          silently keeping a queue built from an empty pre-hydration
          snapshot. When isLoaded is already true at mount (the common case
          — navigating here after the app already loaded), the key never
          changes, so no extra remount happens. */}
      <Route path="/flashcards" element={<Flashcards key={String(isLoaded)} />} />
      {/* Quiz never reads userDataStore into local state until the user
          clicks "התחל מבחן" — by which point loadUserData() has always
          resolved (an IndexedDB read finishes in milliseconds, long before
          a human reads the setup screen and clicks). Unlike Flashcards, no
          key/remount trick is needed here. */}
      <Route path="/quiz" element={<Quiz />} />
      {/* Map never reads userDataStore at all — the graph is derived purely
          from the static topic dataset, so it carries none of the
          hydration hazard the routes above had to design around. */}
      <Route path="/map" element={<Map />} />
    </Routes>
  );
}
```

- [ ] **Step 10: Add the routing test**

In `kb-app/src/App.test.tsx`, add the same `react-force-graph-2d` mock used in `Map.test.tsx` (App.tsx now renders the real `Map` component for the `/map` route, and jsdom can't run the real canvas-based library) — add this near the top of the file, after the existing imports:

```tsx
vi.mock('react-force-graph-2d', () => ({
  default: () => <div />,
}));
```

Then add a new test at the end of `describe('App', ...)`:

```tsx
  it('renders the Map page at "/map"', () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'מפת ידע' })).toBeInTheDocument();
  });
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- Map.test.tsx App.test.tsx theme.test.ts`
Expected: PASS, all tests.

- [ ] **Step 12: Run the full test suite and typecheck/lint**

Run: `cd kb-app && npm run test`
Expected: PASS, every test file in the project (no regressions to Phase 2 or Phase 3 sub-projects #1-#4).

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 13: Full-suite verification gate**

```bash
cd kb-app
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: everything green. The build is expected to grow measurably (a new rendering dependency) and the pre-existing >500kB chunk-size advisory is expected to worsen — non-blocking, consistent with prior sub-projects.

- [ ] **Step 14: Commit**

```bash
cd kb-app
git add package.json package-lock.json src/pages/Map.tsx src/pages/Map.test.tsx src/lib/theme.ts src/lib/theme.test.ts src/App.tsx src/App.test.tsx
git commit -m "feat: add Map page with interactive knowledge graph, routing and theme-change event"
```

---

## Critical files
- `kb-app/src/lib/graph.ts`
- `kb-app/src/pages/Map.tsx`
- `kb-app/src/lib/theme.ts`
- `kb-app/src/components/layout/Header.tsx`
- `kb-app/src/App.tsx`

## Verification (end-to-end, after Task 3)
1. `npm run typecheck && npm run lint && npm run test && npm run build` all green.
2. `npm run dev` — manually confirm: the graph renders all 160 topics with visibly distinct category colors; module/category filters narrow the graph correctly with no dangling edges; clicking a node opens that topic's reader; hovering a node highlights its directly-connected edges; pan/zoom/drag-to-reposition work.
3. Toggle the theme and confirm the graph's colors update to match (not stuck on the colors resolved at the previous theme).
4. Repeat in RTL (already default) — filter row and any on-canvas text read correctly.
5. No regressions to sub-projects #1-#4 (progress/favorites/recents/notes/flashcards/SRS/daily-review/quiz).

## Repo convention note
This repo tracks implementation via `.superpowers/sdd/<plan-name>/progress.md` (one task = one commit, reviewed before moving on) and task briefs under the same directory. Once this plan is approved, follow that existing convention for execution.
