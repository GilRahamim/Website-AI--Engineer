# Phase 2 — Frontend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the blank RTL/theme shell in `kb-app/src/App.tsx` into the full browse-and-read experience — header, hero, sidebar, search/filter/sort, grid/list views, and a topic reader — per the approved design in `docs/superpowers/specs/2026-08-05-phase2-frontend-core-design.md`.

**Architecture:** Two React Router routes (`/` Home, `/topic/:id` Reader) over three static JSON data files imported at build time. One session-only Zustand store holds all browse UI state (search/filter/sort/view/sidebar/accordion). A pure `filterTopics`/`groupTopics` pipeline (unit-tested in isolation) drives what Home renders; a shared keyboard-nav hook gives grid/list cards roving-tabindex arrow/Home/End/Enter navigation. The Reader lazy-fetches per-topic HTML (already split out by the Phase 1 migration) and injects it via `dangerouslySetInnerHTML` — content is our own generated, trusted HTML, never user input.

**Tech Stack:** React 19.2.7, TypeScript 6.0.3, Vite 8.1.5, Tailwind CSS v4, React Router v7, Zustand v5, Vitest 4 + Testing Library (new).

## Global Constraints

- **Content is sacred** — never edit topic text/definitions/formulas; only structure, styling, interaction (`kb-app/CLAUDE.md` rule 1).
- **`topic.id` is the only key** for any user data added in later phases — never derive a new id (rule 2).
- **Local-first** — no network call blocks the UI; the only `fetch` in this phase is the Reader's own lazy per-topic content load, which has a loading state (rule 3).
- **localStorage only for theme** — no heavy content or user data in localStorage this phase (rule 4).
- **RTL + both themes must work on every new screen** — verify manually in both (rule 5).
- **Accessibility is required, not optional**: `focus-visible` on every interactive element, full keyboard nav, AA contrast, `prefers-reduced-motion` (rule 6). The global `:focus-visible` rule and reduced-motion rule already exist in `src/styles/index.css` — reuse them, don't re-implement.
- **Colors only via `--kb-*` OKLCH tokens** in `src/styles/tokens.css` — no hardcoded color values in components (rule 7).
- No KaTeX dependency — formulas are pre-rendered PNGs (`block-formula-img` / `cell-formula-img` classes) inverted via CSS filter in dark mode.
- Definition of Done for the whole phase: `npm run typecheck && npm run lint && npm run test && npm run build` all green, plus manual check in light/dark/RTL/mobile/keyboard-only.
- Every command below runs with `kb-app/` as the working directory.

---

## File Structure

```
kb-app/src/
├─ types.ts                              # Task 2
├─ lib/
│  ├─ theme.ts                           # Task 3
│  ├─ filterTopics.ts                    # Task 6
│  ├─ groupTopics.ts                     # Task 6
│  ├─ highlightMatch.ts                  # Task 8
│  └─ normalize.ts                       # exists (Phase 1)
├─ hooks/
│  └─ useGridKeyboardNav.ts              # Task 7
├─ store/
│  └─ uiStore.ts                         # Task 5
├─ components/
│  ├─ theme/ThemeToggle.tsx              # Task 4
│  ├─ layout/
│  │  ├─ Header.tsx                      # Task 10
│  │  ├─ Hero.tsx                        # Task 11
│  │  ├─ Sidebar.tsx                     # Task 12
│  │  └─ ShortcutsHelp.tsx               # Task 16
│  ├─ browse/
│  │  ├─ TopicCard.tsx                   # Task 8
│  │  ├─ TopicListRow.tsx                # Task 8
│  │  ├─ TopicGrid.tsx                   # Task 9
│  │  ├─ AccordionGroup.tsx              # Task 9
│  │  ├─ SearchBar.tsx                   # Task 13
│  │  ├─ FilterChips.tsx                 # Task 14
│  │  ├─ SortMenu.tsx                    # Task 15
│  │  └─ ViewToggle.tsx                  # Task 15
│  └─ reader/
│     ├─ RelatedTopics.tsx               # Task 18
│     └─ TopicReader.tsx                 # Task 19
├─ pages/
│  ├─ Home.tsx                           # Task 17
│  └─ Reader.tsx                         # Task 20
├─ App.tsx                               # rewritten Task 21
└─ main.tsx                              # modified Tasks 3, 21
```

---

### Task 1: Test tooling + dependencies

**Files:**
- Modify: `kb-app/package.json` (via `npm install`)
- Modify: `kb-app/tsconfig.app.json`
- Modify: `kb-app/vite.config.ts`
- Create: `kb-app/src/setupTests.ts`

**Interfaces:**
- Produces: a working `jsdom` + Testing Library test environment every later task's component tests rely on; `resolveJsonModule` so every later task can `import x from '../data/*.json'`.

- [ ] **Step 1: Install runtime dependencies**

Run: `npm install react-router-dom zustand`

- [ ] **Step 2: Install dev dependencies**

Run: `npm install -D jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`

- [ ] **Step 3: Enable JSON imports in the type checker**

In `tsconfig.app.json`, add `"resolveJsonModule": true` to `compilerOptions` (next to `"allowArbitraryExtensions": true`):

```json
    "allowArbitraryExtensions": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
```

- [ ] **Step 4: Configure the Vitest test environment**

Replace the contents of `vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
});
```

- [ ] **Step 5: Create the test setup file**

Create `src/setupTests.ts`:

```ts
import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement matchMedia. Provide a default stub so any code
// that reads it (src/lib/theme.ts) doesn't crash in tests that don't care
// about system-theme behavior. Tests that DO care override this per-test.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}
```

- [ ] **Step 6: Verify the existing suite still passes under the new config**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all PASS — same as before (`normalize.test.ts`'s 5 tests), now running under `jsdom`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.app.json vite.config.ts src/setupTests.ts
git commit -m "chore: add react-router-dom, zustand, Testing Library; configure jsdom test env"
```

---

### Task 2: Shared TypeScript types

**Files:**
- Create: `kb-app/src/types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Category`, `Topic`, `SearchEntry`, `ModulesMap`, `SortOrder`, `ViewMode`, `FilterState`, `TopicGroup` — imported by nearly every task from here on. Field names and types below are locked; downstream tasks must match them exactly.

- [ ] **Step 1: Write the type definitions**

These mirror `topics.clean.json` / `modules.json` / `search-index.json` exactly (verified against the actual migrated data, not the raw spec doc — the clean data has no `category_icon` field).

```ts
export type Category = 'algorithms' | 'concepts' | 'metrics' | 'formulas' | 'architectures';

export interface Topic {
  id: string;
  module: string;
  module_label: string;
  category: Category;
  category_label: string;
  num: number;
  slug_name: string;
  title: string;
  definition: string;
  related_raw: string[];
  related_match: (string | null)[];
  contentPath: string;
}

export interface SearchEntry {
  id: string;
  search: string;
}

export type ModulesMap = Record<string, string>;

export type SortOrder = 'original' | 'alpha' | 'category';
export type ViewMode = 'grid' | 'list';

export interface FilterState {
  searchQuery: string;
  selectedModules: Set<string>;
  selectedCategories: Set<string>;
  sortOrder: SortOrder;
}

export interface TopicGroup {
  moduleKey: string;
  moduleLabel: string;
  topics: Topic[];
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run typecheck`
Expected: PASS (no test framework needed for a pure type file — this is a structural-only task).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: shared Topic/SearchEntry/FilterState types for Phase 2"
```

---

### Task 3: Theme engine (`lib/theme.ts`)

**Files:**
- Create: `kb-app/src/lib/theme.ts`
- Create: `kb-app/src/lib/theme.test.ts`
- Modify: `kb-app/src/main.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `Theme` (`'light' | 'dark'`), `getInitialTheme(): Theme`, `applyTheme(theme: Theme): void`, `setTheme(theme: Theme): void`, `getStoredTheme(): Theme | null`, `initTheme(): () => void` (returns an unsubscribe function). `ThemeToggle` (Task 4) and `main.tsx` depend on these exact names.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/theme.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getInitialTheme, getStoredTheme, initTheme, setTheme } from './theme';

function mockMatchMedia(prefersDark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: prefersDark,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applyTheme sets the data-theme attribute on <html>', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('setTheme persists to localStorage and applies the attribute', () => {
    setTheme('dark');
    expect(localStorage.getItem('kb-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('getStoredTheme returns null when nothing was stored', () => {
    expect(getStoredTheme()).toBeNull();
  });

  it('getStoredTheme returns the persisted value', () => {
    setTheme('light');
    expect(getStoredTheme()).toBe('light');
  });

  it('getInitialTheme prefers a stored value over system preference', () => {
    mockMatchMedia(true); // system prefers dark
    setTheme('light'); // but user chose light
    expect(getInitialTheme()).toBe('light');
  });

  it('getInitialTheme falls back to system preference when nothing stored', () => {
    mockMatchMedia(true);
    expect(getInitialTheme()).toBe('dark');
  });

  it('initTheme applies the initial theme immediately', () => {
    mockMatchMedia(false);
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('initTheme syncs with system preference changes only when no override is stored', () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | undefined;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
        changeHandler = handler;
      },
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    initTheme();
    changeHandler?.({ matches: true } as MediaQueryListEvent);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('initTheme returns an unsubscribe function', () => {
    mockMatchMedia(false);
    const unsubscribe = initTheme();
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- theme`
Expected: FAIL — `Cannot find module './theme'` (file doesn't exist yet).

- [ ] **Step 3: Implement `src/lib/theme.ts`**

```ts
const STORAGE_KEY = 'kb-theme';

export type Theme = 'light' | 'dark';

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : null;
}

export function getInitialTheme(): Theme {
  return getStoredTheme() ?? (systemPrefersDark() ? 'dark' : 'light');
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * Applies the initial theme immediately (call once, before React renders,
 * to avoid a flash of the wrong theme) and keeps it in sync with OS-level
 * theme changes for as long as the user hasn't picked an explicit override.
 * Returns an unsubscribe function for cleanup.
 */
export function initTheme(): () => void {
  applyTheme(getInitialTheme());

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = (event: MediaQueryListEvent) => {
    if (getStoredTheme() === null) {
      applyTheme(event.matches ? 'dark' : 'light');
    }
  };

  mediaQuery.addEventListener('change', handleChange);
  return () => mediaQuery.removeEventListener('change', handleChange);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- theme`
Expected: PASS (9 tests).

- [ ] **Step 5: Wire theme init into app startup**

Modify `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initTheme } from './lib/theme';
import './styles/index.css';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Verify full suite + typecheck + lint**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/theme.ts src/lib/theme.test.ts src/main.tsx
git commit -m "feat: theme engine — get/set, system-preference sync, localStorage persist"
```

---

### Task 4: `ThemeToggle` component

**Files:**
- Create: `kb-app/src/components/theme/ThemeToggle.tsx`
- Create: `kb-app/src/components/theme/ThemeToggle.test.tsx`

**Interfaces:**
- Consumes: `setTheme` from `../../lib/theme` (Task 3).
- Produces: default-exported `ThemeToggle` component, used by `Header.tsx` (Task 10).

- [ ] **Step 1: Write the failing test**

Create `src/components/theme/ThemeToggle.test.tsx`:

```tsx
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.clear();
  });

  it('renders a button with an accessible label', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toHaveAccessibleName();
  });

  it('flips data-theme on <html> and localStorage when clicked', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('kb-theme')).toBe('dark');

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- ThemeToggle`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ThemeToggle.tsx`**

```tsx
import { useState } from 'react';
import { setTheme, type Theme } from '../../lib/theme';

function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(currentTheme);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'עבור לערכת נושא בהירה' : 'עבור לערכת נושא כהה'}
      className="grid size-9 place-items-center rounded-full border border-[var(--kb-border)] bg-[var(--kb-surface)] text-base transition hover:bg-[var(--kb-surface2)]"
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- ThemeToggle`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/theme/ThemeToggle.tsx src/components/theme/ThemeToggle.test.tsx
git commit -m "feat: ThemeToggle component"
```

---

### Task 5: UI store (`store/uiStore.ts`)

**Files:**
- Create: `kb-app/src/store/uiStore.ts`
- Create: `kb-app/src/store/uiStore.test.ts`

**Interfaces:**
- Consumes: `SortOrder`, `ViewMode` from `../types` (Task 2); `modules.json` data.
- Produces: `useUiStore` Zustand hook with state `searchQuery, selectedModules, selectedCategories, sortOrder, viewMode, sidebarCollapsed, expandedGroups` and actions `setSearchQuery, toggleModule, toggleCategory, clearFilters, setSortOrder, setViewMode, toggleSidebarCollapsed, toggleGroup, expandAllGroups, collapseAllGroups`. Every browse component (Tasks 12–17) reads/writes this store by these exact names.

- [ ] **Step 1: Write the failing tests**

Create `src/store/uiStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import modulesData from '../data/modules.json';
import { useUiStore } from './uiStore';

const allModuleKeys = Object.keys(modulesData as Record<string, string>);

function reset() {
  useUiStore.setState({
    searchQuery: '',
    selectedModules: new Set(),
    selectedCategories: new Set(),
    sortOrder: 'original',
    viewMode: 'grid',
    sidebarCollapsed: false,
    expandedGroups: new Set(allModuleKeys),
  });
}

describe('uiStore', () => {
  beforeEach(reset);

  it('starts with all groups expanded and no filters', () => {
    const state = useUiStore.getState();
    expect(state.expandedGroups.size).toBe(allModuleKeys.length);
    expect(state.selectedModules.size).toBe(0);
    expect(state.selectedCategories.size).toBe(0);
    expect(state.searchQuery).toBe('');
  });

  it('setSearchQuery updates the query', () => {
    useUiStore.getState().setSearchQuery('regression');
    expect(useUiStore.getState().searchQuery).toBe('regression');
  });

  it('toggleModule adds then removes a module (OR-within-type set)', () => {
    const { toggleModule } = useUiStore.getState();
    toggleModule('Intro to Data Science');
    expect(useUiStore.getState().selectedModules.has('Intro to Data Science')).toBe(true);
    toggleModule('Intro to Data Science');
    expect(useUiStore.getState().selectedModules.has('Intro to Data Science')).toBe(false);
  });

  it('toggleCategory adds then removes a category', () => {
    const { toggleCategory } = useUiStore.getState();
    toggleCategory('algorithms');
    expect(useUiStore.getState().selectedCategories.has('algorithms')).toBe(true);
    toggleCategory('algorithms');
    expect(useUiStore.getState().selectedCategories.has('algorithms')).toBe(false);
  });

  it('clearFilters resets query, modules and categories but not sort/view', () => {
    const store = useUiStore.getState();
    store.setSearchQuery('x');
    store.toggleModule('Intro to Data Science');
    store.toggleCategory('algorithms');
    store.setSortOrder('alpha');
    store.clearFilters();

    const state = useUiStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.selectedModules.size).toBe(0);
    expect(state.selectedCategories.size).toBe(0);
    expect(state.sortOrder).toBe('alpha'); // untouched
  });

  it('setSortOrder and setViewMode update their fields', () => {
    useUiStore.getState().setSortOrder('category');
    useUiStore.getState().setViewMode('list');
    expect(useUiStore.getState().sortOrder).toBe('category');
    expect(useUiStore.getState().viewMode).toBe('list');
  });

  it('toggleSidebarCollapsed flips the flag', () => {
    useUiStore.getState().toggleSidebarCollapsed();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    useUiStore.getState().toggleSidebarCollapsed();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it('toggleGroup, expandAllGroups, collapseAllGroups manage expandedGroups', () => {
    const store = useUiStore.getState();
    const someModule = allModuleKeys[0];

    store.toggleGroup(someModule);
    expect(useUiStore.getState().expandedGroups.has(someModule)).toBe(false);

    store.collapseAllGroups();
    expect(useUiStore.getState().expandedGroups.size).toBe(0);

    store.expandAllGroups();
    expect(useUiStore.getState().expandedGroups.size).toBe(allModuleKeys.length);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- uiStore`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/store/uiStore.ts`**

```ts
import { create } from 'zustand';
import modulesData from '../data/modules.json';
import type { SortOrder, ViewMode } from '../types';

const allModuleKeys = Object.keys(modulesData as Record<string, string>);

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

interface UiState {
  searchQuery: string;
  selectedModules: Set<string>;
  selectedCategories: Set<string>;
  sortOrder: SortOrder;
  viewMode: ViewMode;
  sidebarCollapsed: boolean;
  expandedGroups: Set<string>;

  setSearchQuery: (query: string) => void;
  toggleModule: (moduleKey: string) => void;
  toggleCategory: (category: string) => void;
  clearFilters: () => void;
  setSortOrder: (order: SortOrder) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebarCollapsed: () => void;
  toggleGroup: (moduleKey: string) => void;
  expandAllGroups: () => void;
  collapseAllGroups: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  searchQuery: '',
  selectedModules: new Set(),
  selectedCategories: new Set(),
  sortOrder: 'original',
  viewMode: 'grid',
  sidebarCollapsed: false,
  expandedGroups: new Set(allModuleKeys),

  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleModule: (moduleKey) =>
    set((state) => ({ selectedModules: toggleInSet(state.selectedModules, moduleKey) })),
  toggleCategory: (category) =>
    set((state) => ({ selectedCategories: toggleInSet(state.selectedCategories, category) })),
  clearFilters: () =>
    set({ searchQuery: '', selectedModules: new Set(), selectedCategories: new Set() }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleGroup: (moduleKey) =>
    set((state) => ({ expandedGroups: toggleInSet(state.expandedGroups, moduleKey) })),
  expandAllGroups: () => set({ expandedGroups: new Set(allModuleKeys) }),
  collapseAllGroups: () => set({ expandedGroups: new Set() }),
}));
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- uiStore`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/uiStore.ts src/store/uiStore.test.ts
git commit -m "feat: session-only Zustand UI store for browse state"
```

---

### Task 6: `filterTopics` + `groupTopics`

**Files:**
- Create: `kb-app/src/lib/filterTopics.ts`
- Create: `kb-app/src/lib/filterTopics.test.ts`
- Create: `kb-app/src/lib/groupTopics.ts`
- Create: `kb-app/src/lib/groupTopics.test.ts`

**Interfaces:**
- Consumes: `Topic`, `SearchEntry`, `FilterState`, `ModulesMap`, `TopicGroup` from `../types` (Task 2); `normalize` from `./normalize` (exists).
- Produces: `filterTopics(topics, searchIndex, filters): Topic[]`, `groupTopicsByModule(topics, modules): TopicGroup[]` — both consumed by `Home.tsx` (Task 17).

- [ ] **Step 1: Write the failing tests for `filterTopics`**

Create `src/lib/filterTopics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { filterTopics } from './filterTopics';
import type { FilterState, SearchEntry, Topic } from '../types';

function topic(overrides: Partial<Topic>): Topic {
  return {
    id: 'id',
    module: 'Intro to Data Science',
    module_label: 'מבוא',
    category: 'algorithms',
    category_label: 'אלגוריתמים',
    num: 1,
    slug_name: 'slug',
    title: 'Title',
    definition: 'Definition',
    related_raw: [],
    related_match: [],
    contentPath: '/topic-content/x.html',
    ...overrides,
  };
}

const topics: Topic[] = [
  topic({ id: 'a', title: 'Linear Regression', category: 'algorithms', module: 'Intro to Data Science' }),
  topic({ id: 'b', title: 'K-Means Clustering', category: 'algorithms', module: 'Topic 1 - Unsupervised Learning' }),
  topic({ id: 'c', title: 'Bias-Variance Tradeoff', category: 'concepts', module: 'Intro to Data Science' }),
  topic({ id: 'd', title: 'Attention Mechanism', category: 'concepts', module: 'Topic 3 - Deep Learning' }),
];

const searchIndex: SearchEntry[] = [
  { id: 'a', search: 'linear regression definition text' },
  { id: 'b', search: 'k means clustering definition text' },
  { id: 'c', search: 'bias variance tradeoff definition text' },
  { id: 'd', search: 'attention mechanism definition text' },
];

function filters(overrides: Partial<FilterState>): FilterState {
  return {
    searchQuery: '',
    selectedModules: new Set(),
    selectedCategories: new Set(),
    sortOrder: 'original',
    ...overrides,
  };
}

describe('filterTopics', () => {
  it('returns all topics in original order with no filters', () => {
    const result = filterTopics(topics, searchIndex, filters({}));
    expect(result.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('narrows by search query against the normalized search index', () => {
    const result = filterTopics(topics, searchIndex, filters({ searchQuery: 'k-means' }));
    expect(result.map((t) => t.id)).toEqual(['b']);
  });

  it('filters by a single module', () => {
    const result = filterTopics(
      topics,
      searchIndex,
      filters({ selectedModules: new Set(['Intro to Data Science']) }),
    );
    expect(result.map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('is OR within a filter type (two modules selected)', () => {
    const result = filterTopics(
      topics,
      searchIndex,
      filters({ selectedModules: new Set(['Intro to Data Science', 'Topic 3 - Deep Learning']) }),
    );
    expect(result.map((t) => t.id)).toEqual(['a', 'c', 'd']);
  });

  it('is AND across filter types (module + category)', () => {
    const result = filterTopics(
      topics,
      searchIndex,
      filters({
        selectedModules: new Set(['Intro to Data Science']),
        selectedCategories: new Set(['concepts']),
      }),
    );
    expect(result.map((t) => t.id)).toEqual(['c']);
  });

  it('combines search with module/category filters', () => {
    const result = filterTopics(
      topics,
      searchIndex,
      filters({ searchQuery: 'definition', selectedCategories: new Set(['algorithms']) }),
    );
    expect(result.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('sorts alphabetically (Hebrew-aware localeCompare) when sortOrder is alpha', () => {
    const result = filterTopics(topics, searchIndex, filters({ sortOrder: 'alpha' }));
    expect(result.map((t) => t.title)).toEqual([
      'Attention Mechanism',
      'Bias-Variance Tradeoff',
      'K-Means Clustering',
      'Linear Regression',
    ]);
  });

  it('sorts by category label, then title, when sortOrder is category', () => {
    const result = filterTopics(topics, searchIndex, filters({ sortOrder: 'category' }));
    expect(result.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns an empty array when nothing matches', () => {
    const result = filterTopics(topics, searchIndex, filters({ searchQuery: 'nonexistent-term' }));
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- filterTopics`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/filterTopics.ts`**

```ts
import { normalize } from './normalize';
import type { FilterState, SearchEntry, Topic } from '../types';

export function filterTopics(
  topics: Topic[],
  searchIndex: SearchEntry[],
  filters: FilterState,
): Topic[] {
  const normalizedQuery = normalize(filters.searchQuery);
  const matchedIds = normalizedQuery
    ? new Set(
        searchIndex.filter((entry) => entry.search.includes(normalizedQuery)).map((entry) => entry.id),
      )
    : null;

  const result = topics.filter((topic) => {
    if (matchedIds && !matchedIds.has(topic.id)) return false;
    if (filters.selectedModules.size > 0 && !filters.selectedModules.has(topic.module)) return false;
    if (filters.selectedCategories.size > 0 && !filters.selectedCategories.has(topic.category)) {
      return false;
    }
    return true;
  });

  return sortTopics(result, filters.sortOrder);
}

function sortTopics(topics: Topic[], sortOrder: FilterState['sortOrder']): Topic[] {
  if (sortOrder === 'original') return topics;

  const sorted = [...topics];
  if (sortOrder === 'alpha') {
    sorted.sort((a, b) => a.title.localeCompare(b.title, 'he'));
  } else {
    sorted.sort((a, b) => {
      const byCategory = a.category_label.localeCompare(b.category_label, 'he');
      return byCategory !== 0 ? byCategory : a.title.localeCompare(b.title, 'he');
    });
  }
  return sorted;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- filterTopics`
Expected: PASS (9 tests).

- [ ] **Step 5: Write the failing tests for `groupTopics`**

Create `src/lib/groupTopics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { groupTopicsByModule } from './groupTopics';
import type { ModulesMap, Topic } from '../types';

function topic(id: string, module: string): Topic {
  return {
    id,
    module,
    module_label: module,
    category: 'algorithms',
    category_label: 'אלגוריתמים',
    num: 1,
    slug_name: id,
    title: id,
    definition: 'def',
    related_raw: [],
    related_match: [],
    contentPath: `/topic-content/${id}.html`,
  };
}

const modules: ModulesMap = {
  'Module A': 'מודול א',
  'Module B': 'מודול ב',
  'Module C': 'מודול ג',
};

describe('groupTopicsByModule', () => {
  it('groups topics under their module, preserving modules.json order', () => {
    const topics = [topic('b1', 'Module B'), topic('a1', 'Module A'), topic('a2', 'Module A')];
    const groups = groupTopicsByModule(topics, modules);

    expect(groups.map((g) => g.moduleKey)).toEqual(['Module A', 'Module B']);
    expect(groups[0].topics.map((t) => t.id)).toEqual(['a1', 'a2']);
    expect(groups[1].topics.map((t) => t.id)).toEqual(['b1']);
  });

  it('preserves the incoming topic order within a group (does not re-sort)', () => {
    const topics = [topic('a2', 'Module A'), topic('a1', 'Module A')];
    const groups = groupTopicsByModule(topics, modules);
    expect(groups[0].topics.map((t) => t.id)).toEqual(['a2', 'a1']);
  });

  it('omits modules with zero matching topics', () => {
    const topics = [topic('a1', 'Module A')];
    const groups = groupTopicsByModule(topics, modules);
    expect(groups.map((g) => g.moduleKey)).toEqual(['Module A']);
  });

  it('returns an empty array when no topics match any module', () => {
    expect(groupTopicsByModule([], modules)).toEqual([]);
  });

  it('carries the module label from the modules map', () => {
    const topics = [topic('a1', 'Module A')];
    const groups = groupTopicsByModule(topics, modules);
    expect(groups[0].moduleLabel).toBe('מודול א');
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm run test -- groupTopics`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `src/lib/groupTopics.ts`**

```ts
import type { ModulesMap, Topic, TopicGroup } from '../types';

export function groupTopicsByModule(topics: Topic[], modules: ModulesMap): TopicGroup[] {
  return Object.entries(modules)
    .map(([moduleKey, moduleLabel]) => ({
      moduleKey,
      moduleLabel,
      topics: topics.filter((topic) => topic.module === moduleKey),
    }))
    .filter((group) => group.topics.length > 0);
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm run test -- groupTopics`
Expected: PASS (5 tests).

- [ ] **Step 9: Full verification**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/filterTopics.ts src/lib/filterTopics.test.ts src/lib/groupTopics.ts src/lib/groupTopics.test.ts
git commit -m "feat: pure filterTopics + groupTopicsByModule data transforms"
```

---

### Task 7: Grid keyboard navigation hook

**Files:**
- Create: `kb-app/src/hooks/useGridKeyboardNav.ts`
- Create: `kb-app/src/hooks/useGridKeyboardNav.test.tsx`

**Interfaces:**
- Consumes: nothing beyond React.
- Produces: `GridItemProps` (`{ tabIndex, ref, onFocus, onKeyDown }`), `useGridKeyboardNav(itemIds: string[], onActivate: (id: string) => void): { focusedId: string | null; getItemProps: (id: string) => GridItemProps }`. Consumed by `TopicCard`/`TopicListRow` (Task 8), `AccordionGroup`/`TopicGrid` (Task 9), `Home.tsx` (Task 17).
- **Design decision (RTL-simplified nav):** cards form one flat navigable sequence (roving tabindex), not a true 2-D grid — column count is responsive/unknown at the hook level. In RTL, `ArrowRight` moves to the previous item and `ArrowLeft` to the next (reading order starts at the right); `ArrowDown`/`ArrowUp` also move next/previous for simplicity. `Home`/`End` jump to first/last. `Enter` calls `onActivate`.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useGridKeyboardNav.test.tsx`:

```tsx
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGridKeyboardNav } from './useGridKeyboardNav';

function Harness({ onActivate }: { onActivate: (id: string) => void }) {
  const itemIds = ['a', 'b', 'c'];
  const { getItemProps } = useGridKeyboardNav(itemIds, onActivate);
  return (
    <div>
      {itemIds.map((id) => {
        const props = getItemProps(id);
        return (
          <button key={id} data-testid={id} ref={props.ref} tabIndex={props.tabIndex} onFocus={props.onFocus} onKeyDown={props.onKeyDown}>
            {id}
          </button>
        );
      })}
    </div>
  );
}

describe('useGridKeyboardNav', () => {
  it('only the first item is tabbable initially', () => {
    render(<Harness onActivate={() => {}} />);
    expect(screen.getByTestId('a')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('b')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('c')).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowLeft moves focus to the next item (RTL: left = forward)', async () => {
    const user = userEvent.setup();
    render(<Harness onActivate={() => {}} />);
    screen.getByTestId('a').focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('b')).toHaveFocus();
  });

  it('ArrowRight moves focus to the previous item (RTL: right = backward)', async () => {
    const user = userEvent.setup();
    render(<Harness onActivate={() => {}} />);
    screen.getByTestId('b').focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('a')).toHaveFocus();
  });

  it('does not move past the first or last item', async () => {
    const user = userEvent.setup();
    render(<Harness onActivate={() => {}} />);
    screen.getByTestId('a').focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('a')).toHaveFocus();

    screen.getByTestId('c').focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('c')).toHaveFocus();
  });

  it('Home jumps to the first item and End to the last', async () => {
    const user = userEvent.setup();
    render(<Harness onActivate={() => {}} />);
    screen.getByTestId('b').focus();
    await user.keyboard('{End}');
    expect(screen.getByTestId('c')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByTestId('a')).toHaveFocus();
  });

  it('Enter calls onActivate with the focused item id', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} />);
    screen.getByTestId('b').focus();
    await user.keyboard('{Enter}');
    expect(onActivate).toHaveBeenCalledWith('b');
  });
});

function DynamicHarness({ onActivate }: { onActivate: (id: string) => void }) {
  const [itemIds, setItemIds] = useState(['a', 'b', 'c']);
  const { getItemProps } = useGridKeyboardNav(itemIds, onActivate);
  return (
    <div>
      <button type="button" data-testid="narrow" onClick={() => setItemIds(['b', 'c'])}>
        narrow
      </button>
      {itemIds.map((id) => {
        const props = getItemProps(id);
        return (
          <button key={id} data-testid={id} ref={props.ref} tabIndex={props.tabIndex} onFocus={props.onFocus} onKeyDown={props.onKeyDown}>
            {id}
          </button>
        );
      })}
    </div>
  );
}

describe('useGridKeyboardNav — itemIds changes post-mount', () => {
  it('falls back to the new first item when the focused item is filtered out', async () => {
    const user = userEvent.setup();
    render(<DynamicHarness onActivate={() => {}} />);
    expect(screen.getByTestId('a')).toHaveAttribute('tabindex', '0');

    await user.click(screen.getByTestId('narrow')); // itemIds becomes ['b', 'c']; 'a' is gone

    expect(screen.getByTestId('b')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('c')).toHaveAttribute('tabindex', '-1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- useGridKeyboardNav`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/hooks/useGridKeyboardNav.ts`**

```ts
import { useCallback, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

export interface GridItemProps {
  tabIndex: number;
  ref: (element: HTMLElement | null) => void;
  onFocus: () => void;
  onKeyDown: (event: ReactKeyboardEvent) => void;
}

export function useGridKeyboardNav(itemIds: string[], onActivate: (id: string) => void) {
  const [focusedId, setFocusedId] = useState<string | null>(itemIds[0] ?? null);
  const elementsRef = useRef(new Map<string, HTMLElement>());

  // Falls back to the first item whenever the tracked focusedId is no longer
  // present in itemIds (e.g. a filter/search change dropped it) — otherwise
  // every item's tabIndex would resolve to -1 and the grid becomes
  // keyboard-untabbable until a fresh onFocus fires.
  const effectiveFocusedId = useMemo(
    () => (focusedId !== null && itemIds.includes(focusedId) ? focusedId : (itemIds[0] ?? null)),
    [focusedId, itemIds],
  );

  const focusIndex = useCallback(
    (index: number) => {
      if (itemIds.length === 0) return;
      const clamped = Math.max(0, Math.min(index, itemIds.length - 1));
      const id = itemIds[clamped];
      setFocusedId(id);
      elementsRef.current.get(id)?.focus();
    },
    [itemIds],
  );

  const getItemProps = useCallback(
    (id: string): GridItemProps => ({
      tabIndex: id === effectiveFocusedId ? 0 : -1,
      ref: (element) => {
        if (element) {
          elementsRef.current.set(id, element);
        } else {
          elementsRef.current.delete(id);
        }
      },
      onFocus: () => setFocusedId(id),
      onKeyDown: (event) => {
        const currentIndex = itemIds.indexOf(id);
        switch (event.key) {
          case 'ArrowRight': // RTL: right = previous
            event.preventDefault();
            focusIndex(currentIndex - 1);
            break;
          case 'ArrowLeft': // RTL: left = next
            event.preventDefault();
            focusIndex(currentIndex + 1);
            break;
          case 'ArrowDown':
            event.preventDefault();
            focusIndex(currentIndex + 1);
            break;
          case 'ArrowUp':
            event.preventDefault();
            focusIndex(currentIndex - 1);
            break;
          case 'Home':
            event.preventDefault();
            focusIndex(0);
            break;
          case 'End':
            event.preventDefault();
            focusIndex(itemIds.length - 1);
            break;
          case 'Enter':
            event.preventDefault();
            onActivate(id);
            break;
          default:
            break;
        }
      },
    }),
    [effectiveFocusedId, itemIds, focusIndex, onActivate],
  );

  return { focusedId: effectiveFocusedId, getItemProps };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- useGridKeyboardNav`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGridKeyboardNav.ts src/hooks/useGridKeyboardNav.test.tsx
git commit -m "feat: shared roving-tabindex keyboard nav hook for grid/list cards"
```

---

### Task 8: `highlightMatch` + `TopicCard` + `TopicListRow`

**Files:**
- Create: `kb-app/src/lib/highlightMatch.ts`
- Create: `kb-app/src/lib/highlightMatch.test.ts`
- Create: `kb-app/src/components/browse/TopicCard.tsx`
- Create: `kb-app/src/components/browse/TopicListRow.tsx`
- Create: `kb-app/src/components/browse/TopicCard.test.tsx` (covers both components)
- Modify: `kb-app/src/styles/tokens.css` (category hue tokens)
- Modify: `kb-app/src/styles/index.css` (category chip + card depth/hover-lift rules — P0)

**Interfaces:**
- Consumes: `Topic` from `../../types`, `GridItemProps` from `../../hooks/useGridKeyboardNav` (Task 7), `highlightMatch` from `../../lib/highlightMatch`.
- Produces: default-exported `TopicCard({ topic, highlightTerm, itemProps })` and `TopicListRow({ topic, highlightTerm, itemProps })` — both consumed by `TopicGrid`/`AccordionGroup` (Task 9). `highlightMatch(text: string, query: string): { text: string; match: boolean }[]`.

- [ ] **Step 1: Write the failing tests for `highlightMatch`**

Create `src/lib/highlightMatch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { highlightMatch } from './highlightMatch';

describe('highlightMatch', () => {
  it('returns the full text as one non-match segment for an empty query', () => {
    expect(highlightMatch('Linear Regression', '')).toEqual([{ text: 'Linear Regression', match: false }]);
  });

  it('returns the full text as one non-match segment when there is no match', () => {
    expect(highlightMatch('Linear Regression', 'xyz')).toEqual([
      { text: 'Linear Regression', match: false },
    ]);
  });

  it('splits out a case-insensitive match in the middle of the text', () => {
    expect(highlightMatch('Linear Regression', 'regr')).toEqual([
      { text: 'Linear ', match: false },
      { text: 'Regr', match: true },
      { text: 'ession', match: false },
    ]);
  });

  it('matches at the start of the text', () => {
    expect(highlightMatch('Linear Regression', 'linear')).toEqual([
      { text: 'Linear', match: true },
      { text: ' Regression', match: false },
    ]);
  });

  it('matches at the end of the text', () => {
    expect(highlightMatch('K-Means', 'means')).toEqual([
      { text: 'K-', match: false },
      { text: 'Means', match: true },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- highlightMatch`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/highlightMatch.ts`**

```ts
export interface HighlightSegment {
  text: string;
  match: boolean;
}

export function highlightMatch(text: string, query: string): HighlightSegment[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [{ text, match: false }];

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmedQuery.toLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, cursor);
    if (matchIndex === -1) {
      segments.push({ text: text.slice(cursor), match: false });
      break;
    }
    if (matchIndex > cursor) {
      segments.push({ text: text.slice(cursor, matchIndex), match: false });
    }
    segments.push({ text: text.slice(matchIndex, matchIndex + trimmedQuery.length), match: true });
    cursor = matchIndex + trimmedQuery.length;
  }

  return segments.length > 0 ? segments : [{ text, match: false }];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- highlightMatch`
Expected: PASS (5 tests).

- [ ] **Step 5: Add category color tokens**

In `src/styles/tokens.css`, append to the `:root` block:

```css
  --kb-cat-algorithms: oklch(56% 0.14 250);
  --kb-cat-concepts: oklch(58% 0.12 165);
  --kb-cat-metrics: oklch(62% 0.15 75);
  --kb-cat-formulas: oklch(56% 0.15 320);
  --kb-cat-architectures: oklch(56% 0.16 25);
```

And to the `:root[data-theme="dark"]` block:

```css
  --kb-cat-algorithms: oklch(72% 0.13 250);
  --kb-cat-concepts: oklch(74% 0.12 165);
  --kb-cat-metrics: oklch(78% 0.14 75);
  --kb-cat-formulas: oklch(72% 0.14 320);
  --kb-cat-architectures: oklch(72% 0.15 25);
```

- [ ] **Step 6: Add shared card + category-chip CSS (P0 depth/hover-lift)**

Append to `src/styles/index.css`:

```css
.kb-category-chip {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--kb-bg);
  background: var(--kb-muted);
}
.kb-category-chip[data-category='algorithms'] { background: var(--kb-cat-algorithms); }
.kb-category-chip[data-category='concepts'] { background: var(--kb-cat-concepts); }
.kb-category-chip[data-category='metrics'] { background: var(--kb-cat-metrics); }
.kb-category-chip[data-category='formulas'] { background: var(--kb-cat-formulas); }
.kb-category-chip[data-category='architectures'] { background: var(--kb-cat-architectures); }

.kb-topic-card,
.kb-topic-list-row {
  display: block;
  border-radius: 12px;
  border: 1px solid var(--kb-border);
  background: var(--kb-surface);
  box-shadow: var(--kb-shadow-sm);
  text-decoration: none;
  color: inherit;
}
.kb-topic-card:hover,
.kb-topic-card:focus-visible,
.kb-topic-list-row:hover,
.kb-topic-list-row:focus-visible {
  transform: translateY(-2px);
  box-shadow: var(--kb-shadow-md);
}

.kb-topic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}
```

- [ ] **Step 7: Write the failing tests for `TopicCard` and `TopicListRow`**

Create `src/components/browse/TopicCard.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopicCard from './TopicCard';
import TopicListRow from './TopicListRow';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import type { Topic } from '../../types';

const topic: Topic = {
  id: 'Intro to Data Science::algorithms::02_Linear_Regression.docx',
  module: 'Intro to Data Science',
  module_label: 'מבוא',
  category: 'algorithms',
  category_label: 'אלגוריתמים',
  num: 2,
  slug_name: 'Linear Regression',
  title: 'Linear Regression — רגרסיה לינארית',
  definition: 'שיטת למידה מונחית לחיזוי ערך רציף.',
  related_raw: [],
  related_match: [],
  contentPath: '/topic-content/x.html',
};

const itemProps: GridItemProps = {
  tabIndex: 0,
  ref: () => {},
  onFocus: () => {},
  onKeyDown: () => {},
};

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('TopicCard', () => {
  it('links to the topic reader route with an encoded id', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/topic/${encodeURIComponent(topic.id)}`);
  });

  it('renders the category label and definition', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />);
    expect(screen.getByText('אלגוריתמים')).toBeInTheDocument();
    expect(screen.getByText(topic.definition)).toBeInTheDocument();
  });

  it('highlights the search term in the title', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="Linear" itemProps={itemProps} />);
    expect(screen.getByText('Linear')).toBeInTheDocument();
  });

  it('applies keyboard-nav props from the item', () => {
    const onKeyDown = vi.fn();
    renderWithRouter(
      <TopicCard topic={topic} highlightTerm="" itemProps={{ ...itemProps, tabIndex: -1, onKeyDown }} />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('tabindex', '-1');
  });
});

describe('TopicListRow', () => {
  it('links to the topic reader route and shows the title', () => {
    renderWithRouter(<TopicListRow topic={topic} highlightTerm="" itemProps={itemProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/topic/${encodeURIComponent(topic.id)}`);
    expect(link).toHaveTextContent('Linear Regression');
  });
});
```

- [ ] **Step 8: Run to verify it fails**

Run: `npm run test -- TopicCard`
Expected: FAIL — modules not found.

- [ ] **Step 9: Implement `TopicCard.tsx`**

```tsx
import { Link } from 'react-router-dom';
import type { Topic } from '../../types';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import { highlightMatch } from '../../lib/highlightMatch';

interface TopicCardProps {
  topic: Topic;
  highlightTerm: string;
  itemProps: GridItemProps;
}

export default function TopicCard({ topic, highlightTerm, itemProps }: TopicCardProps) {
  const titleSegments = highlightMatch(topic.title, highlightTerm);

  return (
    <Link
      to={`/topic/${encodeURIComponent(topic.id)}`}
      ref={itemProps.ref}
      tabIndex={itemProps.tabIndex}
      onFocus={itemProps.onFocus}
      onKeyDown={itemProps.onKeyDown}
      className="kb-topic-card flex flex-col gap-2 p-4 transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]"
    >
      <span className="kb-category-chip w-fit" data-category={topic.category}>
        {topic.category_label}
      </span>
      <h3 className="text-base font-bold text-[var(--kb-text)]">
        {titleSegments.map((segment, i) =>
          segment.match ? (
            <mark key={i} className="bg-[var(--kb-accent-soft)] text-[var(--kb-text)]">
              {segment.text}
            </mark>
          ) : (
            <span key={i}>{segment.text}</span>
          ),
        )}
      </h3>
      <p className="text-sm text-[var(--kb-muted)] line-clamp-3">{topic.definition}</p>
    </Link>
  );
}
```

- [ ] **Step 10: Implement `TopicListRow.tsx`**

```tsx
import { Link } from 'react-router-dom';
import type { Topic } from '../../types';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import { highlightMatch } from '../../lib/highlightMatch';

interface TopicListRowProps {
  topic: Topic;
  highlightTerm: string;
  itemProps: GridItemProps;
}

export default function TopicListRow({ topic, highlightTerm, itemProps }: TopicListRowProps) {
  const titleSegments = highlightMatch(topic.title, highlightTerm);

  return (
    <Link
      to={`/topic/${encodeURIComponent(topic.id)}`}
      ref={itemProps.ref}
      tabIndex={itemProps.tabIndex}
      onFocus={itemProps.onFocus}
      onKeyDown={itemProps.onKeyDown}
      className="kb-topic-list-row flex min-h-11 items-center gap-3 px-4 py-2 transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]"
    >
      <span className="kb-category-chip shrink-0" data-category={topic.category}>
        {topic.category_label}
      </span>
      <span className="font-semibold text-[var(--kb-text)]">
        {titleSegments.map((segment, i) =>
          segment.match ? (
            <mark key={i} className="bg-[var(--kb-accent-soft)] text-[var(--kb-text)]">
              {segment.text}
            </mark>
          ) : (
            <span key={i}>{segment.text}</span>
          ),
        )}
      </span>
      <span className="truncate text-sm text-[var(--kb-muted)]">{topic.definition}</span>
    </Link>
  );
}
```

- [ ] **Step 11: Run to verify tests pass**

Run: `npm run test -- TopicCard`
Expected: PASS (5 tests).

- [ ] **Step 12: Full verification**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all PASS.

- [ ] **Step 13: Commit**

```bash
git add src/lib/highlightMatch.ts src/lib/highlightMatch.test.ts src/components/browse/TopicCard.tsx src/components/browse/TopicListRow.tsx src/components/browse/TopicCard.test.tsx src/styles/tokens.css src/styles/index.css
git commit -m "feat: TopicCard/TopicListRow with term highlighting and P0 hover-lift depth"
```

---

### Task 9: `TopicGrid` + `AccordionGroup`

**Files:**
- Create: `kb-app/src/components/browse/TopicGrid.tsx`
- Create: `kb-app/src/components/browse/AccordionGroup.tsx`
- Create: `kb-app/src/components/browse/AccordionGroup.test.tsx`

**Interfaces:**
- Consumes: `TopicGroup`, `ViewMode` from `../../types`; `TopicCard`, `TopicListRow` (Task 8); `GridItemProps` from `../../hooks/useGridKeyboardNav` (Task 7).
- Produces: `TopicGrid({ topics, highlightTerm, getItemProps })`, `AccordionGroup({ group, expanded, onToggle, viewMode, highlightTerm, getItemProps })` — both consumed by `Home.tsx` (Task 17).

- [ ] **Step 1: Write the failing test**

Create `src/components/browse/AccordionGroup.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AccordionGroup from './AccordionGroup';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import type { Topic, TopicGroup } from '../../types';

function topic(id: string): Topic {
  return {
    id,
    module: 'Intro to Data Science',
    module_label: 'מבוא',
    category: 'algorithms',
    category_label: 'אלגוריתמים',
    num: 1,
    slug_name: id,
    title: id,
    definition: 'def',
    related_raw: [],
    related_match: [],
    contentPath: `/topic-content/${id}.html`,
  };
}

const group: TopicGroup = {
  moduleKey: 'Intro to Data Science',
  moduleLabel: 'מבוא למדעי הנתונים',
  topics: [topic('a'), topic('b')],
};

const getItemProps = (): GridItemProps => ({ tabIndex: 0, ref: () => {}, onFocus: () => {}, onKeyDown: () => {} });

function renderGroup(expanded: boolean, onToggle = vi.fn(), viewMode: 'grid' | 'list' = 'grid') {
  return render(
    <MemoryRouter>
      <AccordionGroup
        group={group}
        expanded={expanded}
        onToggle={onToggle}
        viewMode={viewMode}
        highlightTerm=""
        getItemProps={getItemProps}
      />
    </MemoryRouter>,
  );
}

describe('AccordionGroup', () => {
  it('shows the module label and topic count on the trigger', () => {
    renderGroup(true);
    expect(screen.getByRole('button', { name: /מבוא למדעי הנתונים/ })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders topic cards when expanded', () => {
    renderGroup(true);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('renders no topic cards when collapsed', () => {
    renderGroup(false);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('reflects expanded state via aria-expanded', () => {
    renderGroup(true);
    expect(screen.getByRole('button', { name: /מבוא למדעי הנתונים/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('calls onToggle when the trigger is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderGroup(true, onToggle);
    await user.click(screen.getByRole('button', { name: /מבוא למדעי הנתונים/ }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('renders a list layout when viewMode is list', () => {
    renderGroup(true, vi.fn(), 'list');
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- AccordionGroup`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TopicGrid.tsx`**

```tsx
import type { Topic } from '../../types';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import TopicCard from './TopicCard';

interface TopicGridProps {
  topics: Topic[];
  highlightTerm: string;
  getItemProps: (id: string) => GridItemProps;
}

export default function TopicGrid({ topics, highlightTerm, getItemProps }: TopicGridProps) {
  return (
    <div className="kb-topic-grid">
      {topics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} highlightTerm={highlightTerm} itemProps={getItemProps(topic.id)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement `AccordionGroup.tsx`**

```tsx
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import type { TopicGroup, ViewMode } from '../../types';
import TopicGrid from './TopicGrid';
import TopicListRow from './TopicListRow';

interface AccordionGroupProps {
  group: TopicGroup;
  expanded: boolean;
  onToggle: () => void;
  viewMode: ViewMode;
  highlightTerm: string;
  getItemProps: (id: string) => GridItemProps;
}

export default function AccordionGroup({
  group,
  expanded,
  onToggle,
  viewMode,
  highlightTerm,
  getItemProps,
}: AccordionGroupProps) {
  const headingId = `group-heading-${group.moduleKey}`;
  const panelId = `group-panel-${group.moduleKey}`;

  return (
    <section className="mb-6">
      <h2>
        <button
          type="button"
          id={headingId}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full min-h-11 items-center justify-between rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface2)] px-4 py-2 text-start font-bold text-[var(--kb-text)]"
        >
          <span>{group.moduleLabel}</span>
          <span className="flex items-center gap-2 text-sm text-[var(--kb-muted)]">
            {group.topics.length}
            <span aria-hidden="true">{expanded ? '▾' : '◂'}</span>
          </span>
        </button>
      </h2>
      {expanded && (
        <div id={panelId} role="region" aria-labelledby={headingId} className="mt-3">
          {viewMode === 'grid' ? (
            <TopicGrid topics={group.topics} highlightTerm={highlightTerm} getItemProps={getItemProps} />
          ) : (
            <ul role="list" className="flex flex-col gap-2">
              {group.topics.map((topic) => (
                <li key={topic.id}>
                  <TopicListRow topic={topic} highlightTerm={highlightTerm} itemProps={getItemProps(topic.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Run to verify tests pass**

Run: `npm run test -- AccordionGroup`
Expected: PASS (6 tests).

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/browse/TopicGrid.tsx src/components/browse/AccordionGroup.tsx src/components/browse/AccordionGroup.test.tsx
git commit -m "feat: TopicGrid + AccordionGroup grouping/expand-collapse"
```

---

### Task 10: `Header`

**Files:**
- Create: `kb-app/src/components/layout/Header.tsx`
- Create: `kb-app/src/components/layout/Header.test.tsx`

**Interfaces:**
- Consumes: `ThemeToggle` from `../theme/ThemeToggle` (Task 4).
- Produces: default-exported `Header` component, consumed by `Home.tsx` (Task 17) and `Reader.tsx` (Task 20).

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/Header.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from './Header';

describe('Header', () => {
  it('renders the brand name', () => {
    render(<Header />);
    expect(screen.getByText('מסד ידע')).toBeInTheDocument();
    expect(screen.getByText('AI Engineer')).toBeInTheDocument();
  });

  it('renders the theme toggle button', () => {
    render(<Header />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses the header landmark', () => {
    render(<Header />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- Header`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `Header.tsx`**

```tsx
import ThemeToggle from '../theme/ThemeToggle';

export default function Header() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--kb-border)] bg-[var(--kb-surface)] px-4 py-3 shadow-[var(--kb-shadow-sm)]">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-xl">🧠</span>
        <div className="flex flex-col leading-tight">
          <strong className="text-[var(--kb-text)]">מסד ידע</strong>
          <span className="text-xs text-[var(--kb-muted)]">AI Engineer</span>
        </div>
      </div>
      <ThemeToggle />
    </header>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- Header`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx src/components/layout/Header.test.tsx
git commit -m "feat: sticky Header with brand + ThemeToggle"
```

---

### Task 11: `Hero`

**Files:**
- Create: `kb-app/src/components/layout/Hero.tsx`
- Create: `kb-app/src/components/layout/Hero.test.tsx`

**Interfaces:**
- Consumes: nothing (pure props).
- Produces: default-exported `Hero({ topicCount, moduleCount })`, consumed by `Home.tsx` (Task 17).

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/Hero.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Hero from './Hero';

describe('Hero', () => {
  it('renders the topic and module counts', () => {
    render(<Hero topicCount={160} moduleCount={5} />);
    expect(screen.getByText('160')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders a heading', () => {
    render(<Hero topicCount={160} moduleCount={5} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- Hero`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `Hero.tsx`**

```tsx
interface HeroProps {
  topicCount: number;
  moduleCount: number;
}

export default function Hero({ topicCount, moduleCount }: HeroProps) {
  return (
    <section className="px-4 py-8 text-center">
      <h1 className="text-2xl font-extrabold text-[var(--kb-text)] sm:text-3xl">מסד ידע — AI Engineer</h1>
      <p className="mx-auto mt-2 max-w-prose text-[var(--kb-text2)]">
        אוסף נושאים מרוכז ללימוד הנדסת AI — אלגוריתמים, מושגים, ארכיטקטורות ועוד.
      </p>
      <div className="mx-auto mt-6 flex w-fit gap-4">
        <div className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] px-6 py-3 shadow-[var(--kb-shadow-sm)]">
          <div className="text-2xl font-bold text-[var(--kb-accent)]">{topicCount}</div>
          <div className="text-sm text-[var(--kb-muted)]">נושאים</div>
        </div>
        <div className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] px-6 py-3 shadow-[var(--kb-shadow-sm)]">
          <div className="text-2xl font-bold text-[var(--kb-accent)]">{moduleCount}</div>
          <div className="text-sm text-[var(--kb-muted)]">מודולים</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- Hero`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Hero.tsx src/components/layout/Hero.test.tsx
git commit -m "feat: Hero section with title, description, stat cards"
```

---

### Task 12: `Sidebar`

**Files:**
- Create: `kb-app/src/components/layout/Sidebar.tsx`
- Create: `kb-app/src/components/layout/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `useUiStore` (`selectedModules`, `selectedCategories`, `sidebarCollapsed`, `toggleModule`, `toggleCategory`, `toggleSidebarCollapsed`) from `../../store/uiStore` (Task 5); `ModulesMap` from `../../types`.
- Produces: default-exported `Sidebar({ modules, moduleCounts, categoryLabels, categoryCounts })`, consumed by `Home.tsx` (Task 17).

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/Sidebar.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';
import { useUiStore } from '../../store/uiStore';

const modules = { 'Intro to Data Science': 'מבוא למדעי הנתונים', 'Topic 3 - Deep Learning': 'Deep Learning' };
const moduleCounts = { 'Intro to Data Science': 8, 'Topic 3 - Deep Learning': 43 };
const categoryLabels = { algorithms: 'אלגוריתמים', concepts: 'מושגים' };
const categoryCounts = { algorithms: 45, concepts: 69 };

function reset() {
  useUiStore.setState({ selectedModules: new Set(), selectedCategories: new Set(), sidebarCollapsed: false });
}

describe('Sidebar', () => {
  beforeEach(reset);

  it('lists every module with its label and count', () => {
    render(
      <Sidebar modules={modules} moduleCounts={moduleCounts} categoryLabels={categoryLabels} categoryCounts={categoryCounts} />,
    );
    expect(screen.getByText('מבוא למדעי הנתונים')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('lists every category with its label and count', () => {
    render(
      <Sidebar modules={modules} moduleCounts={moduleCounts} categoryLabels={categoryLabels} categoryCounts={categoryCounts} />,
    );
    expect(screen.getByText('אלגוריתמים')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('toggles a module filter in the store when clicked', async () => {
    const user = userEvent.setup();
    render(
      <Sidebar modules={modules} moduleCounts={moduleCounts} categoryLabels={categoryLabels} categoryCounts={categoryCounts} />,
    );
    await user.click(screen.getByRole('button', { name: /מבוא למדעי הנתונים/ }));
    expect(useUiStore.getState().selectedModules.has('Intro to Data Science')).toBe(true);
  });

  it('reflects an active module filter via aria-pressed', async () => {
    const user = userEvent.setup();
    render(
      <Sidebar modules={modules} moduleCounts={moduleCounts} categoryLabels={categoryLabels} categoryCounts={categoryCounts} />,
    );
    const button = screen.getByRole('button', { name: /מבוא למדעי הנתונים/ });
    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('has a mobile-drawer toggle button with aria-expanded', () => {
    render(
      <Sidebar modules={modules} moduleCounts={moduleCounts} categoryLabels={categoryLabels} categoryCounts={categoryCounts} />,
    );
    expect(screen.getByRole('button', { name: 'פתח/סגור תפריט' })).toHaveAttribute('aria-expanded');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- Sidebar`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `Sidebar.tsx`**

```tsx
import type { ModulesMap } from '../../types';
import { useUiStore } from '../../store/uiStore';

interface SidebarProps {
  modules: ModulesMap;
  moduleCounts: Record<string, number>;
  categoryLabels: Record<string, string>;
  categoryCounts: Record<string, number>;
}

export default function Sidebar({ modules, moduleCounts, categoryLabels, categoryCounts }: SidebarProps) {
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleModule = useUiStore((s) => s.toggleModule);
  const toggleCategory = useUiStore((s) => s.toggleCategory);
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);

  return (
    <>
      <button
        type="button"
        aria-label="פתח/סגור תפריט"
        aria-expanded={!sidebarCollapsed}
        onClick={toggleSidebarCollapsed}
        className="min-h-11 min-w-11 rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface)] md:hidden"
      >
        <span aria-hidden="true">☰</span>
      </button>
      <aside
        className={`shrink-0 border-e border-[var(--kb-border)] bg-[var(--kb-surface)] p-4 ${
          sidebarCollapsed ? 'hidden md:block md:w-16' : 'block w-full md:w-64'
        }`}
      >
        <nav aria-label="ניווט מודולים">
          <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">מודולים</h2>
          <ul className="flex flex-col gap-1">
            {Object.entries(modules).map(([key, label]) => (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={selectedModules.has(key)}
                  onClick={() => toggleModule(key)}
                  className="flex min-h-11 w-full items-center justify-between rounded-md px-2 text-start text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] aria-pressed:bg-[var(--kb-accent-soft)]"
                >
                  <span>{label}</span>
                  <span className="text-[var(--kb-muted)]">{moduleCounts[key] ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="ניווט קטגוריות" className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">קטגוריות</h2>
          <ul className="flex flex-col gap-1">
            {Object.entries(categoryLabels).map(([key, label]) => (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={selectedCategories.has(key)}
                  onClick={() => toggleCategory(key)}
                  className="flex min-h-11 w-full items-center justify-between rounded-md px-2 text-start text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] aria-pressed:bg-[var(--kb-accent-soft)]"
                >
                  <span>{label}</span>
                  <span className="text-[var(--kb-muted)]">{categoryCounts[key] ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- Sidebar`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/Sidebar.test.tsx
git commit -m "feat: Sidebar — module/category nav with counts, collapse, mobile toggle"
```

---

### Task 13: `SearchBar`

**Files:**
- Create: `kb-app/src/components/browse/SearchBar.tsx`
- Create: `kb-app/src/components/browse/SearchBar.test.tsx`

**Interfaces:**
- Consumes: `useUiStore` (`searchQuery`, `setSearchQuery`) from `../../store/uiStore` (Task 5).
- Produces: default-exported `SearchBar` component, consumed by `Home.tsx` (Task 17).

- [ ] **Step 1: Write the failing test**

Create `src/components/browse/SearchBar.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from './SearchBar';
import { useUiStore } from '../../store/uiStore';

function reset() {
  useUiStore.setState({ searchQuery: '' });
}

describe('SearchBar', () => {
  beforeEach(() => {
    reset();
    // shouldAdvanceTime is required: Testing Library's asyncWrapper (used internally
    // by user.type/user.keyboard) detects Vitest's faked timers and otherwise never
    // advances them itself, deadlocking every `await user.type(...)` call.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('renders an accessible search input', () => {
    render(<SearchBar />);
    expect(screen.getByRole('searchbox', { name: 'חיפוש נושאים' })).toBeInTheDocument();
  });

  it('debounces typed input before updating the store', async () => {
    const user = userEvent.setup({ delay: null });
    render(<SearchBar />);
    const input = screen.getByRole('searchbox');

    await user.type(input, 'regression');
    expect(useUiStore.getState().searchQuery).toBe('');

    vi.advanceTimersByTime(250);
    expect(useUiStore.getState().searchQuery).toBe('regression');
  });

  it('focuses the input when "/" is pressed and it is not already focused', async () => {
    const user = userEvent.setup({ delay: null });
    render(<SearchBar />);
    const input = screen.getByRole('searchbox');
    expect(input).not.toHaveFocus();

    await user.keyboard('/');
    expect(input).toHaveFocus();
  });

  it('clears the query when Escape is pressed while focused', async () => {
    const user = userEvent.setup({ delay: null });
    render(<SearchBar />);
    const input = screen.getByRole('searchbox');

    await user.type(input, 'x');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    vi.advanceTimersByTime(250);
    expect(useUiStore.getState().searchQuery).toBe('');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- SearchBar`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `SearchBar.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '../../store/uiStore';

export default function SearchBar() {
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const [localValue, setLocalValue] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearchQuery(localValue), 200);
    return () => window.clearTimeout(timeoutId);
  }, [localValue, setSearchQuery]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === '/' && document.activeElement !== inputRef.current) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        setLocalValue('');
        setSearchQuery('');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchQuery]);

  return (
    <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface)] px-3">
      <span className="sr-only">חיפוש נושאים</span>
      <span aria-hidden="true">🔍</span>
      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        aria-label="חיפוש נושאים"
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        placeholder="חפש נושא… (לחץ / למיקוד)"
        className="w-full bg-transparent py-2 text-[var(--kb-text)] outline-none placeholder:text-[var(--kb-muted)]"
      />
    </label>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- SearchBar`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/browse/SearchBar.tsx src/components/browse/SearchBar.test.tsx
git commit -m "feat: SearchBar — debounced input, / to focus, Esc to clear"
```

---

### Task 14: `FilterChips`

**Files:**
- Create: `kb-app/src/components/browse/FilterChips.tsx`
- Create: `kb-app/src/components/browse/FilterChips.test.tsx`

**Interfaces:**
- Consumes: `useUiStore` (`selectedModules`, `selectedCategories`, `toggleModule`, `toggleCategory`, `clearFilters`) from `../../store/uiStore` (Task 5); `ModulesMap` from `../../types`.
- Produces: default-exported `FilterChips({ modules, categoryLabels })`, consumed by `Home.tsx` (Task 17).

- [ ] **Step 1: Write the failing test**

Create `src/components/browse/FilterChips.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterChips from './FilterChips';
import { useUiStore } from '../../store/uiStore';

const modules = { 'Intro to Data Science': 'מבוא למדעי הנתונים' };
const categoryLabels = { algorithms: 'אלגוריתמים' };

function reset() {
  useUiStore.setState({ selectedModules: new Set(), selectedCategories: new Set() });
}

describe('FilterChips', () => {
  beforeEach(reset);

  it('renders nothing when no filters are active', () => {
    const { container } = render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a chip per active module and category filter', () => {
    useUiStore.setState({
      selectedModules: new Set(['Intro to Data Science']),
      selectedCategories: new Set(['algorithms']),
    });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    expect(screen.getByText(/מבוא למדעי הנתונים/)).toBeInTheDocument();
    expect(screen.getByText(/אלגוריתמים/)).toBeInTheDocument();
  });

  it('removes a single chip on click without affecting others', async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      selectedModules: new Set(['Intro to Data Science']),
      selectedCategories: new Set(['algorithms']),
    });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    await user.click(screen.getByText(/מבוא למדעי הנתונים/));
    expect(useUiStore.getState().selectedModules.size).toBe(0);
    expect(useUiStore.getState().selectedCategories.size).toBe(1);
  });

  it('"clear all" removes every filter', async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      selectedModules: new Set(['Intro to Data Science']),
      selectedCategories: new Set(['algorithms']),
    });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    await user.click(screen.getByRole('button', { name: 'נקה הכול' }));
    expect(useUiStore.getState().selectedModules.size).toBe(0);
    expect(useUiStore.getState().selectedCategories.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- FilterChips`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `FilterChips.tsx`**

```tsx
import type { ModulesMap } from '../../types';
import { useUiStore } from '../../store/uiStore';

interface FilterChipsProps {
  modules: ModulesMap;
  categoryLabels: Record<string, string>;
}

export default function FilterChips({ modules, categoryLabels }: FilterChipsProps) {
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const toggleModule = useUiStore((s) => s.toggleModule);
  const toggleCategory = useUiStore((s) => s.toggleCategory);
  const clearFilters = useUiStore((s) => s.clearFilters);

  const chips = [
    ...[...selectedModules].map((key) => ({ kind: 'module' as const, key, label: modules[key] ?? key })),
    ...[...selectedCategories].map((key) => ({
      kind: 'category' as const,
      key,
      label: categoryLabels[key] ?? key,
    })),
  ];

  if (chips.length === 0) return null;

  return (
    <div role="list" aria-label="סינון פעיל" className="flex flex-wrap gap-2 py-2">
      {chips.map((chip) => (
        <button
          key={`${chip.kind}-${chip.key}`}
          type="button"
          role="listitem"
          onClick={() => (chip.kind === 'module' ? toggleModule(chip.key) : toggleCategory(chip.key))}
          className="flex min-h-11 items-center gap-1 rounded-full bg-[var(--kb-accent-soft)] px-3 text-sm text-[var(--kb-text)]"
        >
          {chip.label} <span aria-hidden="true">✕</span>
        </button>
      ))}
      <button
        type="button"
        onClick={clearFilters}
        className="min-h-11 rounded-full border border-[var(--kb-border-strong)] px-3 text-sm text-[var(--kb-muted)]"
      >
        נקה הכול
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- FilterChips`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/browse/FilterChips.tsx src/components/browse/FilterChips.test.tsx
git commit -m "feat: FilterChips — active filter chips with per-chip removal + clear all"
```

---

### Task 15: `SortMenu` + `ViewToggle`

**Files:**
- Create: `kb-app/src/components/browse/SortMenu.tsx`
- Create: `kb-app/src/components/browse/ViewToggle.tsx`
- Create: `kb-app/src/components/browse/SortControls.test.tsx`

**Interfaces:**
- Consumes: `useUiStore` (`sortOrder`, `setSortOrder`, `viewMode`, `setViewMode`) from `../../store/uiStore` (Task 5); `SortOrder` from `../../types`.
- Produces: default-exported `SortMenu`, default-exported `ViewToggle` — both consumed by `Home.tsx` (Task 17).

- [ ] **Step 1: Write the failing test**

Create `src/components/browse/SortControls.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SortMenu from './SortMenu';
import ViewToggle from './ViewToggle';
import { useUiStore } from '../../store/uiStore';

function reset() {
  useUiStore.setState({ sortOrder: 'original', viewMode: 'grid' });
}

describe('SortMenu', () => {
  beforeEach(reset);

  it('reflects the current sort order', () => {
    render(<SortMenu />);
    expect(screen.getByLabelText('מיין נושאים לפי')).toHaveValue('original');
  });

  it('updates the store when a new option is chosen', async () => {
    const user = userEvent.setup();
    render(<SortMenu />);
    await user.selectOptions(screen.getByLabelText('מיין נושאים לפי'), 'alpha');
    expect(useUiStore.getState().sortOrder).toBe('alpha');
  });
});

describe('ViewToggle', () => {
  beforeEach(reset);

  it('marks the active view via aria-pressed', () => {
    render(<ViewToggle />);
    expect(screen.getByRole('button', { name: 'תצוגת רשת' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'תצוגת רשימה' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches viewMode in the store when clicked', async () => {
    const user = userEvent.setup();
    render(<ViewToggle />);
    await user.click(screen.getByRole('button', { name: 'תצוגת רשימה' }));
    expect(useUiStore.getState().viewMode).toBe('list');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- SortControls`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `SortMenu.tsx`**

```tsx
import type { SortOrder } from '../../types';
import { useUiStore } from '../../store/uiStore';

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'original', label: 'מקורי' },
  { value: 'alpha', label: 'א־ת' },
  { value: 'category', label: 'קטגוריה' },
];

export default function SortMenu() {
  const sortOrder = useUiStore((s) => s.sortOrder);
  const setSortOrder = useUiStore((s) => s.setSortOrder);

  return (
    <label className="flex items-center gap-2 text-sm text-[var(--kb-text)]">
      <span>מיון:</span>
      <select
        aria-label="מיין נושאים לפי"
        value={sortOrder}
        onChange={(event) => setSortOrder(event.target.value as SortOrder)}
        className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 4: Implement `ViewToggle.tsx`**

```tsx
import { useUiStore } from '../../store/uiStore';

export default function ViewToggle() {
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);

  return (
    <div role="group" aria-label="תצוגה" className="flex gap-1">
      <button
        type="button"
        aria-pressed={viewMode === 'grid'}
        aria-label="תצוגת רשת"
        onClick={() => setViewMode('grid')}
        className="grid min-h-11 min-w-11 place-items-center rounded-md border border-[var(--kb-border)] aria-pressed:bg-[var(--kb-accent-soft)]"
      >
        <span aria-hidden="true">▦</span>
      </button>
      <button
        type="button"
        aria-pressed={viewMode === 'list'}
        aria-label="תצוגת רשימה"
        onClick={() => setViewMode('list')}
        className="grid min-h-11 min-w-11 place-items-center rounded-md border border-[var(--kb-border)] aria-pressed:bg-[var(--kb-accent-soft)]"
      >
        <span aria-hidden="true">☰</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify tests pass**

Run: `npm run test -- SortControls`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/browse/SortMenu.tsx src/components/browse/ViewToggle.tsx src/components/browse/SortControls.test.tsx
git commit -m "feat: SortMenu + ViewToggle browse controls"
```

---

### Task 16: `ShortcutsHelp`

**Files:**
- Create: `kb-app/src/components/layout/ShortcutsHelp.tsx`
- Create: `kb-app/src/components/layout/ShortcutsHelp.test.tsx`
- Modify: `kb-app/src/styles/tokens.css` (backdrop-overlay token — golden rule 7 forbids the raw `bg-black/40` this component needs otherwise)

**Interfaces:**
- Consumes: nothing beyond React.
- Produces: default-exported `ShortcutsHelp({ open, onClose })`, consumed by `Home.tsx` (Task 17).

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/ShortcutsHelp.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShortcutsHelp from './ShortcutsHelp';

describe('ShortcutsHelp', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ShortcutsHelp open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a modal dialog listing the shortcuts when open', () => {
    render(<ShortcutsHelp open onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsHelp open onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'סגור' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsHelp open onClose={onClose} />);
    await user.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- ShortcutsHelp`
Expected: FAIL — module not found.

- [ ] **Step 3: Add the backdrop-overlay token**

Append to the `:root` block in `src/styles/tokens.css`:

```css
  --kb-overlay: oklch(0% 0 0 / 0.4);
```

- [ ] **Step 4: Implement `ShortcutsHelp.tsx`**

```tsx
interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: '/', description: 'מיקוד בחיפוש' },
  { keys: 'Esc', description: 'ניקוי חיפוש / סגירת חלונית' },
  { keys: '?', description: 'הצגת קיצורי המקלדת האלה' },
  { keys: '↑ ↓ → ←', description: 'ניווט בין כרטיסים' },
  { keys: 'Enter', description: 'פתיחת נושא' },
  { keys: 'Home / End', description: 'מעבר לכרטיס הראשון / האחרון' },
];

export default function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-20 grid place-items-center bg-[var(--kb-overlay)] p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-6 shadow-[var(--kb-shadow-lg)]"
      >
        <h2 id="shortcuts-title" className="mb-4 text-lg font-bold text-[var(--kb-text)]">
          קיצורי מקלדת
        </h2>
        <dl className="flex flex-col gap-2">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-center justify-between gap-4">
              <dt>
                <kbd className="rounded border border-[var(--kb-border-strong)] bg-[var(--kb-surface2)] px-2 py-1 font-mono text-sm">
                  {shortcut.keys}
                </kbd>
              </dt>
              <dd className="text-sm text-[var(--kb-text2)]">{shortcut.description}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          aria-label="סגור"
          onClick={onClose}
          className="mt-6 min-h-11 w-full rounded-md border border-[var(--kb-border)] text-[var(--kb-text)]"
        >
          סגור
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- ShortcutsHelp`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/ShortcutsHelp.tsx src/components/layout/ShortcutsHelp.test.tsx src/styles/tokens.css
git commit -m "feat: ShortcutsHelp modal (? key shortcut reference)"
```

---

### Task 17: `Home` page

**Files:**
- Create: `kb-app/src/pages/Home.tsx`
- Create: `kb-app/src/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `topics.clean.json`, `modules.json`, `search-index.json`; `filterTopics`, `groupTopicsByModule` (Task 6); `useGridKeyboardNav` (Task 7); `useUiStore` (Task 5); `Header` (Task 10); `Hero` (Task 11); `Sidebar` (Task 12); `SearchBar` (Task 13); `FilterChips` (Task 14); `SortMenu`/`ViewToggle` (Task 15); `AccordionGroup` (Task 9); `ShortcutsHelp` (Task 16).
- Produces: default-exported `Home` page, consumed by `App.tsx` (Task 21).

- [ ] **Step 1: Write the failing test**

Create `src/pages/Home.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { useUiStore } from '../store/uiStore';
import topicsData from '../data/topics.clean.json';

function reset() {
  const allModuleKeys = [...new Set(topicsData.map((t) => t.module))];
  useUiStore.setState({
    searchQuery: '',
    selectedModules: new Set(),
    selectedCategories: new Set(),
    sortOrder: 'original',
    viewMode: 'grid',
    sidebarCollapsed: false,
    expandedGroups: new Set(allModuleKeys),
  });
}

describe('Home', () => {
  beforeEach(reset);

  it('renders the hero with the real topic count', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(String(topicsData.length))).toBeInTheDocument();
  });

  it('renders every module as an accordion group, expanded by default', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const totalCards = screen.getAllByRole('link', { name: /./ }).length;
    expect(totalCards).toBeGreaterThan(0);
  });

  it('narrows visible topics when the search store value changes', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const before = screen.getAllByRole('link').length;

    act(() => {
      useUiStore.getState().setSearchQuery('regression');
    });

    const after = screen.getAllByRole('link').length;
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  it('narrows visible topics when a module filter is toggled from the store', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const before = screen.getAllByRole('link').length;

    act(() => {
      useUiStore.getState().toggleModule(topicsData[0].module);
    });

    const after = screen.getAllByRole('link').length;
    expect(after).toBeLessThan(before);
  });

  it('opens the shortcuts help modal on "?"', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('?');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- Home`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `Home.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import searchIndexRaw from '../data/search-index.json';
import type { ModulesMap, SearchEntry, Topic } from '../types';
import { filterTopics } from '../lib/filterTopics';
import { groupTopicsByModule } from '../lib/groupTopics';
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav';
import { useUiStore } from '../store/uiStore';
import Header from '../components/layout/Header';
import Hero from '../components/layout/Hero';
import Sidebar from '../components/layout/Sidebar';
import ShortcutsHelp from '../components/layout/ShortcutsHelp';
import SearchBar from '../components/browse/SearchBar';
import FilterChips from '../components/browse/FilterChips';
import SortMenu from '../components/browse/SortMenu';
import ViewToggle from '../components/browse/ViewToggle';
import AccordionGroup from '../components/browse/AccordionGroup';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const searchIndex = searchIndexRaw as SearchEntry[];

const categoryLabels: Record<string, string> = Object.fromEntries(
  topics.map((topic) => [topic.category, topic.category_label]),
);
const moduleCounts: Record<string, number> = Object.fromEntries(
  Object.keys(modules).map((key) => [key, topics.filter((topic) => topic.module === key).length]),
);
const categoryCounts: Record<string, number> = Object.fromEntries(
  Object.keys(categoryLabels).map((key) => [key, topics.filter((topic) => topic.category === key).length]),
);

export default function Home() {
  const navigate = useNavigate();
  const searchQuery = useUiStore((s) => s.searchQuery);
  const selectedModules = useUiStore((s) => s.selectedModules);
  const selectedCategories = useUiStore((s) => s.selectedCategories);
  const sortOrder = useUiStore((s) => s.sortOrder);
  const viewMode = useUiStore((s) => s.viewMode);
  const expandedGroups = useUiStore((s) => s.expandedGroups);
  const toggleGroup = useUiStore((s) => s.toggleGroup);
  const expandAllGroups = useUiStore((s) => s.expandAllGroups);
  const collapseAllGroups = useUiStore((s) => s.collapseAllGroups);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const filtered = useMemo(
    () => filterTopics(topics, searchIndex, { searchQuery, selectedModules, selectedCategories, sortOrder }),
    [searchQuery, selectedModules, selectedCategories, sortOrder],
  );

  const groups = useMemo(() => groupTopicsByModule(filtered, modules), [filtered]);

  const visibleItemIds = useMemo(
    () => groups.filter((group) => expandedGroups.has(group.moduleKey)).flatMap((group) => group.topics.map((t) => t.id)),
    [groups, expandedGroups],
  );

  const { getItemProps } = useGridKeyboardNav(visibleItemIds, (id) => navigate(`/topic/${encodeURIComponent(id)}`));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isTyping = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === '?' && !isTyping) {
        setShortcutsOpen(true);
      }
      if (event.key === 'Escape') {
        setShortcutsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <Header />
      <Hero topicCount={topics.length} moduleCount={Object.keys(modules).length} />
      <div className="flex flex-col md:flex-row">
        <Sidebar modules={modules} moduleCounts={moduleCounts} categoryLabels={categoryLabels} categoryCounts={categoryCounts} />
        <main className="flex-1 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar />
            <SortMenu />
            <ViewToggle />
          </div>
          <FilterChips modules={modules} categoryLabels={categoryLabels} />
          <div className="mb-4 flex gap-2 text-sm">
            <button type="button" onClick={expandAllGroups} className="min-h-11 text-[var(--kb-accent)] underline">
              הרחב הכול
            </button>
            <button type="button" onClick={collapseAllGroups} className="min-h-11 text-[var(--kb-accent)] underline">
              כווץ הכול
            </button>
          </div>
          {groups.length === 0 && <p className="text-[var(--kb-muted)]">לא נמצאו נושאים.</p>}
          {groups.map((group) => (
            <AccordionGroup
              key={group.moduleKey}
              group={group}
              expanded={expandedGroups.has(group.moduleKey)}
              onToggle={() => toggleGroup(group.moduleKey)}
              viewMode={viewMode}
              highlightTerm={searchQuery}
              getItemProps={getItemProps}
            />
          ))}
        </main>
      </div>
      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- Home`
Expected: PASS (5 tests).

- [ ] **Step 5: Full verification**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Home.tsx src/pages/Home.test.tsx
git commit -m "feat: Home page — composes header/hero/sidebar/browse controls/accordion grid"
```

---

### Task 18: `RelatedTopics`

**Files:**
- Create: `kb-app/src/components/reader/RelatedTopics.tsx`
- Create: `kb-app/src/components/reader/RelatedTopics.test.tsx`

**Interfaces:**
- Consumes: `Topic` from `../../types`.
- Produces: default-exported `RelatedTopics({ relatedIds, topicsById })`, consumed by `TopicReader.tsx` (Task 19).

- [ ] **Step 1: Write the failing test**

Create `src/components/reader/RelatedTopics.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RelatedTopics from './RelatedTopics';
import type { Topic } from '../../types';

function topic(id: string, title: string): Topic {
  return {
    id,
    module: 'Intro to Data Science',
    module_label: 'מבוא',
    category: 'algorithms',
    category_label: 'אלגוריתמים',
    num: 1,
    slug_name: id,
    title,
    definition: 'def',
    related_raw: [],
    related_match: [],
    contentPath: `/topic-content/${id}.html`,
  };
}

const topicsById = new Map<string, Topic>([
  ['a', topic('a', 'Logistic Regression')],
  ['b', topic('b', 'Bias-Variance Tradeoff')],
]);

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('RelatedTopics', () => {
  it('renders a link for each resolved related id', () => {
    renderWithRouter(<RelatedTopics relatedIds={['a', 'b']} topicsById={topicsById} />);
    expect(screen.getByText('Logistic Regression')).toBeInTheDocument();
    expect(screen.getByText('Bias-Variance Tradeoff')).toBeInTheDocument();
  });

  it('skips null entries', () => {
    renderWithRouter(<RelatedTopics relatedIds={['a', null, null]} topicsById={topicsById} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('skips ids that cannot be resolved in topicsById', () => {
    renderWithRouter(<RelatedTopics relatedIds={['a', 'nonexistent']} topicsById={topicsById} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders nothing when there are no resolvable related topics', () => {
    const { container } = renderWithRouter(<RelatedTopics relatedIds={[null, null]} topicsById={topicsById} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('links to the encoded topic route', () => {
    renderWithRouter(<RelatedTopics relatedIds={['a']} topicsById={topicsById} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', `/topic/${encodeURIComponent('a')}`);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- RelatedTopics`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `RelatedTopics.tsx`**

```tsx
import { Link } from 'react-router-dom';
import type { Topic } from '../../types';

interface RelatedTopicsProps {
  relatedIds: (string | null)[];
  topicsById: Map<string, Topic>;
}

export default function RelatedTopics({ relatedIds, topicsById }: RelatedTopicsProps) {
  const resolved = relatedIds
    .filter((id): id is string => id !== null)
    .map((id) => topicsById.get(id))
    .filter((topic): topic is Topic => topic !== undefined);

  if (resolved.length === 0) return null;

  return (
    <nav aria-label="נושאים קשורים" className="mt-8 border-t border-[var(--kb-border)] pt-4">
      <h2 className="mb-2 text-lg font-bold text-[var(--kb-text)]">נושאים קשורים</h2>
      <ul className="flex flex-wrap gap-2">
        {resolved.map((topic) => (
          <li key={topic.id}>
            <Link
              to={`/topic/${encodeURIComponent(topic.id)}`}
              className="inline-block min-h-11 rounded-full border border-[var(--kb-border)] px-3 py-1 text-sm text-[var(--kb-accent)] hover:bg-[var(--kb-accent-soft)]"
            >
              {topic.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- RelatedTopics`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/RelatedTopics.tsx src/components/reader/RelatedTopics.test.tsx
git commit -m "feat: RelatedTopics — resolves related_match ids, skips nulls/orphans"
```

---

### Task 19: `TopicReader`

**Files:**
- Create: `kb-app/src/components/reader/TopicReader.tsx`
- Create: `kb-app/src/components/reader/TopicReader.test.tsx`
- Modify: `kb-app/src/styles/index.css` (formula image sizing + dark-mode invert)

**Interfaces:**
- Consumes: `Topic` from `../../types`; `RelatedTopics` (Task 18); the browser `fetch` API for lazy content load.
- Produces: default-exported `TopicReader({ topic, topicsById })`, consumed by `Reader.tsx` (Task 20).

- [ ] **Step 1: Write the failing test**

Create `src/components/reader/TopicReader.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopicReader from './TopicReader';
import type { Topic } from '../../types';

const topic: Topic = {
  id: 'Intro to Data Science::algorithms::02_Linear_Regression.docx',
  module: 'Intro to Data Science',
  module_label: 'מבוא למדעי הנתונים',
  category: 'algorithms',
  category_label: 'אלגוריתמים',
  num: 2,
  slug_name: 'Linear Regression',
  title: 'Linear Regression — רגרסיה לינארית',
  definition: 'שיטת למידה מונחית לחיזוי ערך רציף.',
  related_raw: [],
  related_match: ['related-id'],
  contentPath: '/topic-content/x.html',
};

const relatedTopic: Topic = { ...topic, id: 'related-id', title: 'Related Topic' };
const topicsById = new Map([[relatedTopic.id, relatedTopic]]);

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    text: () => Promise.resolve('<p>תוכן הנושא המלא</p>'),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <TopicReader topic={topic} topicsById={topicsById} />
    </MemoryRouter>,
  );
}

describe('TopicReader', () => {
  it('renders the breadcrumb, category badge, title and definition', () => {
    renderWithRouter();
    expect(screen.getByText('מבוא למדעי הנתונים')).toBeInTheDocument();
    expect(screen.getByText('אלגוריתמים')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: topic.title })).toBeInTheDocument();
    expect(screen.getByText(topic.definition)).toBeInTheDocument();
  });

  it('fetches and renders the full content from contentPath', async () => {
    renderWithRouter();
    expect(fetch).toHaveBeenCalledWith('/topic-content/x.html');
    await waitFor(() => expect(screen.getByText('תוכן הנושא המלא')).toBeInTheDocument());
  });

  it('renders resolved related topics', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('Related Topic')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- TopicReader`
Expected: FAIL — module not found.

- [ ] **Step 3: Add formula image CSS**

Append to `src/styles/index.css`:

```css
.kb-topic-content img.block-formula-img {
  display: block;
  max-width: 100%;
  margin: 1rem auto;
}
.kb-topic-content img.cell-formula-img {
  height: 1.1em;
  vertical-align: middle;
}
[data-theme='dark'] .kb-topic-content img.block-formula-img,
[data-theme='dark'] .kb-topic-content img.cell-formula-img {
  filter: invert(1);
}
```

- [ ] **Step 4: Implement `TopicReader.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Topic } from '../../types';
import RelatedTopics from './RelatedTopics';

interface TopicReaderProps {
  topic: Topic;
  topicsById: Map<string, Topic>;
}

export default function TopicReader({ topic, topicsById }: TopicReaderProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    fetch(topic.contentPath)
      .then((response) => response.text())
      .then((text) => {
        if (!cancelled) setHtml(text);
      });
    return () => {
      cancelled = true;
    };
  }, [topic.contentPath]);

  return (
    <article className="mx-auto max-w-3xl p-4">
      <nav aria-label="breadcrumb" className="mb-2 flex items-center gap-2 text-sm text-[var(--kb-muted)]">
        <Link to="/" className="hover:underline">
          מסד ידע
        </Link>
        <span aria-hidden="true">›</span>
        <span>{topic.module_label}</span>
      </nav>
      <span className="kb-category-chip mb-2 w-fit" data-category={topic.category}>
        {topic.category_label}
      </span>
      <h1 className="mb-2 text-2xl font-extrabold text-[var(--kb-text)]">{topic.title}</h1>
      <p className="mb-6 text-[var(--kb-text2)]">{topic.definition}</p>
      {html === null ? (
        <p role="status">טוען תוכן…</p>
      ) : (
        <div className="kb-topic-content" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <RelatedTopics relatedIds={topic.related_match} topicsById={topicsById} />
    </article>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- TopicReader`
Expected: PASS (3 tests).

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/reader/TopicReader.tsx src/components/reader/TopicReader.test.tsx src/styles/index.css
git commit -m "feat: TopicReader — breadcrumb, badge, lazy content fetch, formula image styling"
```

---

### Task 20: `Reader` page

**Files:**
- Create: `kb-app/src/pages/Reader.tsx`
- Create: `kb-app/src/pages/Reader.test.tsx`

**Interfaces:**
- Consumes: `topics.clean.json`; `useParams` from `react-router-dom`; `Header` (Task 10); `TopicReader` (Task 19).
- Produces: default-exported `Reader` page, consumed by `App.tsx` (Task 21).

- [ ] **Step 1: Write the failing test**

Create `src/pages/Reader.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Reader from './Reader';
import topicsData from '../data/topics.clean.json';

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ text: () => Promise.resolve('<p>content</p>') }) as unknown as typeof fetch;
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/topic/:id" element={<Reader />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Reader', () => {
  it('renders the topic matching the encoded id in the route', () => {
    const knownTopic = topicsData[0];
    renderAt(`/topic/${encodeURIComponent(knownTopic.id)}`);
    expect(screen.getByRole('heading', { name: knownTopic.title })).toBeInTheDocument();
  });

  it('shows a not-found message for an unknown id', () => {
    renderAt(`/topic/${encodeURIComponent('does-not-exist')}`);
    expect(screen.getByRole('alert')).toHaveTextContent('הנושא לא נמצא');
  });

  it('always renders the Header', () => {
    const knownTopic = topicsData[0];
    renderAt(`/topic/${encodeURIComponent(knownTopic.id)}`);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- Reader`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `Reader.tsx`**

```tsx
import { useParams } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import type { Topic } from '../types';
import Header from '../components/layout/Header';
import TopicReader from '../components/reader/TopicReader';

const topics = topicsRaw as Topic[];
const topicsById = new Map(topics.map((topic) => [topic.id, topic]));

export default function Reader() {
  const { id } = useParams<{ id: string }>();
  const topic = id ? topicsById.get(decodeURIComponent(id)) : undefined;

  return (
    <>
      <Header />
      <main className="p-4">
        {topic ? <TopicReader topic={topic} topicsById={topicsById} /> : <p role="alert">הנושא לא נמצא.</p>}
      </main>
    </>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- Reader`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Reader.tsx src/pages/Reader.test.tsx
git commit -m "feat: Reader page — topic lookup by route id, not-found state"
```

---

### Task 21: Wire routing into `App.tsx` / `main.tsx`

**Files:**
- Modify: `kb-app/src/App.tsx`
- Modify: `kb-app/src/main.tsx`
- Create: `kb-app/src/App.test.tsx`

**Interfaces:**
- Consumes: `Home` (Task 17), `Reader` (Task 20), `initTheme` (Task 3).
- Produces: the fully routed app — nothing further consumes this; it's the integration point.

- [ ] **Step 1: Write the failing test**

Create `src/App.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import topicsData from './data/topics.clean.json';

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ text: () => Promise.resolve('<p>content</p>') }) as unknown as typeof fetch;
});

describe('App', () => {
  it('renders Home at "/"', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: /מסד ידע/ })).toBeInTheDocument();
  });

  it('renders the Reader at "/topic/:id" for a real topic id', () => {
    const knownTopic = topicsData[0];
    render(
      <MemoryRouter initialEntries={[`/topic/${encodeURIComponent(knownTopic.id)}`]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: knownTopic.title })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- App.test`
Expected: FAIL — `App` still renders the Phase 0 placeholder, not Home/Reader.

- [ ] **Step 3: Rewrite `App.tsx`**

```tsx
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/topic/:id" element={<Reader />} />
    </Routes>
  );
}
```

- [ ] **Step 4: Wrap the app in `BrowserRouter` in `main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initTheme } from './lib/theme';
import './styles/index.css';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- App.test`
Expected: PASS (2 tests).

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all PASS, `dist/` produced.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/main.tsx src/App.test.tsx
git commit -m "feat: wire BrowserRouter — Home at /, Reader at /topic/:id"
```

---

### Task 22: Final verification + manual QA pass

**Files:** none (verification only).

**Interfaces:** none — this task confirms every prior task's deliverable integrates correctly, per `kb-app/CLAUDE.md`'s Definition of Done and the design spec's own Definition of Done.

- [ ] **Step 1: Run the full automated gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all four commands exit 0. Note the final test count (should be roughly 90+ tests across all `*.test.ts`/`*.test.tsx` files added in Tasks 1–21).

- [ ] **Step 2: Manual check — light theme**

Run: `npm run dev`, open the printed local URL. Confirm: header/hero/sidebar/cards render with light tokens, no unstyled flash, category chips are legible.

- [ ] **Step 3: Manual check — dark theme**

Click the `ThemeToggle` button (moon/sun icon in the header). Confirm: every surface (background/surface/card) is visibly distinct per the P0 depth requirement, formula images in a topic reader (open any topic from the `algorithms` or `formulas` category) invert to stay legible, category chip colors remain legible.

- [ ] **Step 4: Manual check — RTL**

Confirm text alignment, icon placement (chevengeron/arrow directions), and the sidebar's `border-e` are all correct for right-to-left reading — this should already hold since `index.css`/Tailwind defaults follow the document's `dir="rtl"` from Phase 0, but verify visually.

- [ ] **Step 5: Manual check — keyboard-only pass**

Using only the keyboard: press `/` to focus search, type a query, `Esc` to clear it, `Tab` to a topic card, arrow keys to move between cards, `Enter` to open a topic, `Esc`/click on the reader's breadcrumb to get back to Home, `?` to open and close the shortcuts modal. Confirm a visible focus ring appears at every step (the shared `:focus-visible` rule from `index.css`).

- [ ] **Step 6: Manual check — mobile viewport**

In devtools, switch to a ~375px-wide viewport. Confirm: the sidebar collapses behind the `☰` drawer toggle, all interactive targets are comfortably tappable (≥44px — already encoded via `min-h-11`/`min-w-11` Tailwind classes throughout), grid cards reflow to a single column.

- [ ] **Step 7: Confirm no regressions vs. the Phase 0 baseline**

Confirm the app no longer shows the Phase 0 "הבנייה החלה" placeholder text anywhere, and that `npm run preview` (after `npm run build`) serves the same experience as `npm run dev`.

- [ ] **Step 8: Commit if any fixes were needed during manual QA**

If Steps 2–7 surfaced any fix, commit it separately with a clear message, e.g.:

```bash
git add -A
git commit -m "fix: <what manual QA caught>"
```

If nothing needed fixing, this task requires no commit — Phase 2 is complete as of Task 21's commit.

---

## Definition of Done (whole phase)

- `npm run typecheck && npm run lint && npm run test && npm run build` all green (Task 22, Step 1).
- Every P0 fix present: shadow/hover-lift on cards (Task 8), `focus-visible` everywhere (inherited global rule, verified Task 22 Step 5), full grid keyboard nav (Task 7), clear surface/card depth distinction in both themes (Task 22 Steps 2–3).
- All 11 "existing features to restore" working: header (10), hero (11), sidebar (12), search (13), multi-filter (14), accordion (9), sort (15), grid/list (8+9+15), reader (19+20), formula rendering as images (19), theme switching (3+4).
- Manual check passes: light theme, dark theme, RTL, mobile viewport, keyboard-only (Task 22).
- No hardcoded colors outside `--kb-*` tokens — every component above uses `var(--kb-*)` or a `--kb-*`-driven CSS class.
