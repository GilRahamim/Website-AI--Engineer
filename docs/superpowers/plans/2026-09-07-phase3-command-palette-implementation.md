# Phase 3, Sub-project #6 — Command Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user press Cmd/Ctrl+K from anywhere in the app to open a quick-jump overlay that searches topics by title and runs quick actions (jump to a page, toggle theme) — and, as a prerequisite, extract the module/category filter markup now duplicated across `Flashcards.tsx`, `Quiz.tsx`, and `Map.tsx` into a shared component.

**Architecture:** Two independent pure `src/lib` modules (`categoryLabels.ts`, `commandPalette.ts`) back two components: a small presentational `TopicFilters` consumed by the three existing filter pages, and a globally-mounted `CommandPalette` overlay that owns its own open/query/selection state, reuses the existing `normalize()` Hebrew-aware matcher, and drives navigation via `useNavigate()` and theme switching via the existing `setTheme()`.

**Tech Stack:** React 19, TypeScript, `react-router-dom`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-07-phase3-command-palette-design.md`

## Global Constraints

- `src/lib/categoryLabels.ts` and `src/lib/commandPalette.ts` are pure: no store import, no DOM access, no React.
- `filterResults` matches topics by **title only** (not the full definition-text search index `Home.tsx` uses) and caps topic matches at 8.
- An empty (or whitespace-only, after `normalize()`) query returns all actions and zero topics — never an arbitrary slice of the 160-topic dataset.
- Cmd/Ctrl+K is captured globally, including while a text field is focused — no "am I typing" guard (a modifier combo never collides with normal typing, unlike this app's existing bare `/`/`?` shortcuts).
- No `useState` setter may be called synchronously in a bare `useEffect` body — only inside its cleanup, or inside an event-handler/listener callback (`react-hooks/set-state-in-effect`). `CommandPalette`'s focus-management effect (mirroring `ShortcutsHelp.tsx`) does ref work and `.focus()` only, never `setState`; state resets happen inside the keydown/click handlers that trigger them.
- `Home.tsx`'s own multi-select Sidebar/FilterChips filter system is out of scope for the `TopicFilters` extraction — it was never part of the duplication.
- RTL, both themes, `--kb-*` tokens only (golden rule 7) apply to every new UI element — no hardcoded colors.
- Every new interactive element needs `focus-visible` support and a `min-h-11` (44px) touch target, matching every existing control in this codebase.

---

## Task 1: `src/lib/categoryLabels.ts` — shared category-label derivation

**Files:**
- Create: `kb-app/src/lib/categoryLabels.ts`
- Test: `kb-app/src/lib/categoryLabels.test.ts`

**Interfaces:**
- Produces: `buildCategoryLabels(topics: Topic[]): Record<string, string>`.

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/lib/categoryLabels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCategoryLabels } from './categoryLabels';
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

describe('buildCategoryLabels', () => {
  it('maps each distinct category to its label', () => {
    const topics: Topic[] = [
      topic({ category: 'concepts', category_label: 'מושגים' }),
      topic({ category: 'metrics', category_label: 'מדדים' }),
    ];
    expect(buildCategoryLabels(topics)).toEqual({ concepts: 'מושגים', metrics: 'מדדים' });
  });

  it('is last-write-wins for repeated categories, matching Object.fromEntries', () => {
    const topics: Topic[] = [
      topic({ category: 'concepts', category_label: 'A' }),
      topic({ category: 'concepts', category_label: 'B' }),
    ];
    expect(buildCategoryLabels(topics)).toEqual({ concepts: 'B' });
  });

  it('returns an empty object for an empty topic list', () => {
    expect(buildCategoryLabels([])).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- categoryLabels.test.ts`
Expected: FAIL — `./categoryLabels` does not exist.

- [ ] **Step 3: Implement `categoryLabels.ts`**

Create `kb-app/src/lib/categoryLabels.ts`:

```ts
import type { Topic } from '../types';

export function buildCategoryLabels(topics: Topic[]): Record<string, string> {
  return Object.fromEntries(topics.map((t) => [t.category, t.category_label]));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- categoryLabels.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add kb-app/src/lib/categoryLabels.ts kb-app/src/lib/categoryLabels.test.ts
git commit -m "feat: add buildCategoryLabels shared derivation"
```

---

## Task 2: `src/components/browse/TopicFilters.tsx` — shared filter dropdowns

**Files:**
- Create: `kb-app/src/components/browse/TopicFilters.tsx`
- Test: `kb-app/src/components/browse/TopicFilters.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 directly (takes `categoryLabels` as a plain `Record<string, string>` prop — its caller is responsible for building it, via `buildCategoryLabels` from Task 1).
- Produces: default-exported `TopicFilters` component with props `{ modules: ModulesMap; categoryLabels: Record<string, string>; selectedModule: string; selectedCategory: string; onModuleChange: (value: string) => void; onCategoryChange: (value: string) => void }`. Renders exactly two `<label>` elements (module select labeled "מודול", category select labeled "קטגוריה") as siblings — no wrapping `<div>` of its own, so callers keep their own surrounding layout container.

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/components/browse/TopicFilters.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicFilters from './TopicFilters';

const modules = { m1: 'מודול אחד', m2: 'מודול שתיים' };
const categoryLabels = { concepts: 'מושגים', metrics: 'מדדים' };

describe('TopicFilters', () => {
  it('renders module and category selects with the right options', () => {
    render(
      <TopicFilters
        modules={modules}
        categoryLabels={categoryLabels}
        selectedModule="all"
        selectedCategory="all"
        onModuleChange={() => {}}
        onCategoryChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('מודול')).toBeInTheDocument();
    expect(screen.getByLabelText('קטגוריה')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'מודול אחד' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'מושגים' })).toBeInTheDocument();
  });

  it('calls onModuleChange with the new value when the module select changes', async () => {
    const user = userEvent.setup();
    const onModuleChange = vi.fn();
    render(
      <TopicFilters
        modules={modules}
        categoryLabels={categoryLabels}
        selectedModule="all"
        selectedCategory="all"
        onModuleChange={onModuleChange}
        onCategoryChange={() => {}}
      />,
    );
    await user.selectOptions(screen.getByLabelText('מודול'), 'm1');
    expect(onModuleChange).toHaveBeenCalledWith('m1');
  });

  it('calls onCategoryChange with the new value when the category select changes', async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    render(
      <TopicFilters
        modules={modules}
        categoryLabels={categoryLabels}
        selectedModule="all"
        selectedCategory="all"
        onModuleChange={() => {}}
        onCategoryChange={onCategoryChange}
      />,
    );
    await user.selectOptions(screen.getByLabelText('קטגוריה'), 'metrics');
    expect(onCategoryChange).toHaveBeenCalledWith('metrics');
  });

  it('reflects the currently selected values', () => {
    render(
      <TopicFilters
        modules={modules}
        categoryLabels={categoryLabels}
        selectedModule="m2"
        selectedCategory="metrics"
        onModuleChange={() => {}}
        onCategoryChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('מודול')).toHaveValue('m2');
    expect(screen.getByLabelText('קטגוריה')).toHaveValue('metrics');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- TopicFilters.test.tsx`
Expected: FAIL — `./TopicFilters` does not exist.

- [ ] **Step 3: Implement `TopicFilters.tsx`**

Create `kb-app/src/components/browse/TopicFilters.tsx`:

```tsx
import type { ModulesMap } from '../../types';

interface TopicFiltersProps {
  modules: ModulesMap;
  categoryLabels: Record<string, string>;
  selectedModule: string;
  selectedCategory: string;
  onModuleChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}

export default function TopicFilters({
  modules,
  categoryLabels,
  selectedModule,
  selectedCategory,
  onModuleChange,
  onCategoryChange,
}: TopicFiltersProps) {
  return (
    <>
      <label className="flex flex-col text-sm text-[var(--kb-text)]">
        מודול
        <select
          value={selectedModule}
          onChange={(e) => onModuleChange(e.target.value)}
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
          onChange={(e) => onCategoryChange(e.target.value)}
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
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- TopicFilters.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add kb-app/src/components/browse/TopicFilters.tsx kb-app/src/components/browse/TopicFilters.test.tsx
git commit -m "feat: add shared TopicFilters component"
```

---

## Task 3: Refactor `Flashcards.tsx` to use `buildCategoryLabels` + `TopicFilters`

**Files:**
- Modify: `kb-app/src/pages/Flashcards.tsx:1-16` (imports + module-level consts), `kb-app/src/pages/Flashcards.tsx:157-187` (module/category JSX)
- Test: `kb-app/src/pages/Flashcards.test.tsx` (existing — must pass unchanged)

**Interfaces:**
- Consumes: `buildCategoryLabels` (Task 1), `TopicFilters` (Task 2).

- [ ] **Step 1: Run the existing test suite to confirm the baseline is green**

Run: `cd kb-app && npm run test -- Flashcards.test.tsx`
Expected: PASS (baseline, before refactor)

- [ ] **Step 2: Replace the module-level imports and constants**

In `kb-app/src/pages/Flashcards.tsx`, replace:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import type { ModulesMap, ProgressStatus, SrsRating, Topic } from '../types';
import { isDue } from '../lib/srs';
import { ALL_STATUSES, STATUS_LABELS } from '../lib/progressStatus';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const topicsById = new Map(topics.map((t) => [t.id, t]));
const categoryLabels: Record<string, string> = Object.fromEntries(
  topics.map((t) => [t.category, t.category_label]),
);
```

with:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import type { ModulesMap, ProgressStatus, SrsRating, Topic } from '../types';
import { isDue } from '../lib/srs';
import { ALL_STATUSES, STATUS_LABELS } from '../lib/progressStatus';
import { buildCategoryLabels } from '../lib/categoryLabels';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';
import TopicFilters from '../components/browse/TopicFilters';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const topicsById = new Map(topics.map((t) => [t.id, t]));
const categoryLabels = buildCategoryLabels(topics);
```

- [ ] **Step 3: Replace the module/category filter JSX with `TopicFilters`**

In the same file, replace:

```tsx
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="flex flex-col text-sm text-[var(--kb-text)]">
            מודול
            <select
              value={selectedModule}
              onChange={(e) => handleModuleChange(e.target.value)}
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
              onChange={(e) => handleCategoryChange(e.target.value)}
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
          <label className="flex flex-col text-sm text-[var(--kb-text)]">
            מצב למידה
```

with:

```tsx
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <TopicFilters
            modules={modules}
            categoryLabels={categoryLabels}
            selectedModule={selectedModule}
            selectedCategory={selectedCategory}
            onModuleChange={handleModuleChange}
            onCategoryChange={handleCategoryChange}
          />
          <label className="flex flex-col text-sm text-[var(--kb-text)]">
            מצב למידה
```

(Leave everything else in the file — including the closing `</select></label>` of the status dropdown and everything after it — untouched.)

- [ ] **Step 4: Run the existing test suite to confirm no regression**

Run: `cd kb-app && npm run test -- Flashcards.test.tsx`
Expected: PASS — same test count as Step 1, unchanged.

- [ ] **Step 5: Commit**

```bash
git add kb-app/src/pages/Flashcards.tsx
git commit -m "refactor: use shared TopicFilters in Flashcards"
```

---

## Task 4: Refactor `Quiz.tsx` to use `buildCategoryLabels` + `TopicFilters`

**Files:**
- Modify: `kb-app/src/pages/Quiz.tsx:1-16` (imports + module-level consts), `kb-app/src/pages/Quiz.tsx:136-166` (module/category JSX)
- Test: `kb-app/src/pages/Quiz.test.tsx` (existing — must pass unchanged)

**Interfaces:**
- Consumes: `buildCategoryLabels` (Task 1), `TopicFilters` (Task 2).

- [ ] **Step 1: Run the existing test suite to confirm the baseline is green**

Run: `cd kb-app && npm run test -- Quiz.test.tsx`
Expected: PASS (baseline, before refactor)

- [ ] **Step 2: Replace the module-level imports and constants**

In `kb-app/src/pages/Quiz.tsx`, replace:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import type { ModulesMap, ProgressStatus, Topic } from '../types';
import { buildQuiz, type QuizQuestion } from '../lib/quiz';
import { ALL_STATUSES, STATUS_LABELS } from '../lib/progressStatus';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const topicsById = new Map(topics.map((t) => [t.id, t]));
const categoryLabels: Record<string, string> = Object.fromEntries(
  topics.map((t) => [t.category, t.category_label]),
);
```

with:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import type { ModulesMap, ProgressStatus, Topic } from '../types';
import { buildQuiz, type QuizQuestion } from '../lib/quiz';
import { ALL_STATUSES, STATUS_LABELS } from '../lib/progressStatus';
import { buildCategoryLabels } from '../lib/categoryLabels';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';
import TopicFilters from '../components/browse/TopicFilters';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const topicsById = new Map(topics.map((t) => [t.id, t]));
const categoryLabels = buildCategoryLabels(topics);
```

- [ ] **Step 3: Replace the module/category filter JSX with `TopicFilters`**

In the same file, replace:

```tsx
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
            <label className="flex flex-col text-sm text-[var(--kb-text)]">
              מצב למידה
```

with:

```tsx
            <TopicFilters
              modules={modules}
              categoryLabels={categoryLabels}
              selectedModule={selectedModule}
              selectedCategory={selectedCategory}
              onModuleChange={setSelectedModule}
              onCategoryChange={setSelectedCategory}
            />
            <label className="flex flex-col text-sm text-[var(--kb-text)]">
              מצב למידה
```

(`setSelectedModule`/`setSelectedCategory` are the plain `useState` setters already in this file — Quiz never needed a wrapper handler here, unlike Flashcards, since it only reads filters at click-time in `handleStart`.)

- [ ] **Step 4: Run the existing test suite to confirm no regression**

Run: `cd kb-app && npm run test -- Quiz.test.tsx`
Expected: PASS — same test count as Step 1, unchanged.

- [ ] **Step 5: Commit**

```bash
git add kb-app/src/pages/Quiz.tsx
git commit -m "refactor: use shared TopicFilters in Quiz"
```

---

## Task 5: Refactor `Map.tsx` to use `buildCategoryLabels` + `TopicFilters`

**Files:**
- Modify: `kb-app/src/pages/Map.tsx:1-14` (imports + module-level consts), `kb-app/src/pages/Map.tsx:101-133` (module/category JSX)
- Test: `kb-app/src/pages/Map.test.tsx` (existing — must pass unchanged)

**Interfaces:**
- Consumes: `buildCategoryLabels` (Task 1), `TopicFilters` (Task 2).

- [ ] **Step 1: Run the existing test suite to confirm the baseline is green**

Run: `cd kb-app && npm run test -- Map.test.tsx`
Expected: PASS (baseline, before refactor)

- [ ] **Step 2: Replace the module-level imports and constants**

In `kb-app/src/pages/Map.tsx`, replace:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import type { Category, ModulesMap, Topic } from '../types';
import { buildGraphData, type GraphLink, type GraphNode } from '../lib/graph';
import Header from '../components/layout/Header';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const categoryLabels: Record<string, string> = Object.fromEntries(
  topics.map((t) => [t.category, t.category_label]),
);
```

with:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import type { Category, ModulesMap, Topic } from '../types';
import { buildGraphData, type GraphLink, type GraphNode } from '../lib/graph';
import { buildCategoryLabels } from '../lib/categoryLabels';
import Header from '../components/layout/Header';
import TopicFilters from '../components/browse/TopicFilters';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const categoryLabels = buildCategoryLabels(topics);
```

- [ ] **Step 3: Replace the module/category filter JSX with `TopicFilters`**

In the same file, replace:

```tsx
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
          <p className="text-sm text-[var(--kb-muted)]">{`${graphData.nodes.length} נושאים, ${graphData.links.length} קשרים`}</p>
        </div>
```

with:

```tsx
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <TopicFilters
            modules={modules}
            categoryLabels={categoryLabels}
            selectedModule={selectedModule}
            selectedCategory={selectedCategory}
            onModuleChange={setSelectedModule}
            onCategoryChange={setSelectedCategory}
          />
          <p className="text-sm text-[var(--kb-muted)]">{`${graphData.nodes.length} נושאים, ${graphData.links.length} קשרים`}</p>
        </div>
```

- [ ] **Step 4: Run the existing test suite to confirm no regression**

Run: `cd kb-app && npm run test -- Map.test.tsx`
Expected: PASS — same test count as Step 1, unchanged.

- [ ] **Step 5: Commit**

```bash
git add kb-app/src/pages/Map.tsx
git commit -m "refactor: use shared TopicFilters in Map"
```

---

## Task 6: `src/lib/commandPalette.ts` — pure action list + result filtering

**Files:**
- Create: `kb-app/src/lib/commandPalette.ts`
- Test: `kb-app/src/lib/commandPalette.test.ts`

**Interfaces:**
- Consumes: `normalize` from `kb-app/src/lib/normalize.ts` (existing — `normalize(s: string): string`, lowercases, strips niqqud/geresh/hyphens, collapses whitespace).
- Produces: `PaletteAction { id: string; label: string }`; `buildActionList(): PaletteAction[]` (five fixed entries, ids `'home' | 'flashcards' | 'quiz' | 'map' | 'toggle-theme'`); `filterResults(query: string, actions: PaletteAction[], topics: Topic[]): { actions: PaletteAction[]; topics: Topic[] }`.

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/lib/commandPalette.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildActionList, filterResults } from './commandPalette';
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
  topic({ id: 'a', title: 'רגרסיה לוגיסטית' }),
  topic({ id: 'b', title: 'רגרסיה ליניארית' }),
  topic({ id: 'c', title: 'עצי החלטה' }),
];

describe('buildActionList', () => {
  it('returns the five fixed actions', () => {
    const actions = buildActionList();
    expect(actions.map((a) => a.id).sort()).toEqual(['flashcards', 'home', 'map', 'quiz', 'toggle-theme']);
  });
});

describe('filterResults', () => {
  const actions = buildActionList();

  it('returns all actions and no topics for an empty query', () => {
    const result = filterResults('', actions, topics);
    expect(result.actions).toEqual(actions);
    expect(result.topics).toEqual([]);
  });

  it('returns all actions and no topics for a whitespace-only query', () => {
    const result = filterResults('   ', actions, topics);
    expect(result.actions).toEqual(actions);
    expect(result.topics).toEqual([]);
  });

  it('matches an action by its label', () => {
    const result = filterResults('כרטיסיות', actions, topics);
    expect(result.actions.map((a) => a.id)).toEqual(['flashcards']);
  });

  it('matches topics by title, normalized and Hebrew-aware', () => {
    const result = filterResults('רגרסיה', actions, topics);
    expect(result.topics.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('matches case-insensitively via normalize', () => {
    const englishTopics: Topic[] = [topic({ id: 'x', title: 'Gradient Descent' })];
    const result = filterResults('GRADIENT', actions, englishTopics);
    expect(result.topics.map((t) => t.id)).toEqual(['x']);
  });

  it('caps topic matches at 8', () => {
    const manyTopics: Topic[] = Array.from({ length: 12 }, (_, i) =>
      topic({ id: `t${i}`, title: `נושא משותף ${i}` }),
    );
    const result = filterResults('נושא משותף', actions, manyTopics);
    expect(result.topics).toHaveLength(8);
  });

  it('returns empty arrays when nothing matches', () => {
    const result = filterResults('zzzzzzz', actions, topics);
    expect(result.actions).toEqual([]);
    expect(result.topics).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- commandPalette.test.ts`
Expected: FAIL — `./commandPalette` does not exist.

- [ ] **Step 3: Implement `commandPalette.ts`**

Create `kb-app/src/lib/commandPalette.ts`:

```ts
import type { Topic } from '../types';
import { normalize } from './normalize';

export interface PaletteAction {
  id: string;
  label: string;
}

const TOPIC_RESULT_LIMIT = 8;

export function buildActionList(): PaletteAction[] {
  return [
    { id: 'home', label: 'בית' },
    { id: 'flashcards', label: 'כרטיסיות' },
    { id: 'quiz', label: 'מבחן' },
    { id: 'map', label: 'מפת ידע' },
    { id: 'toggle-theme', label: 'החלף ערכת נושא' },
  ];
}

export function filterResults(
  query: string,
  actions: PaletteAction[],
  topics: Topic[],
): { actions: PaletteAction[]; topics: Topic[] } {
  const normalizedQuery = normalize(query);
  if (normalizedQuery === '') {
    return { actions, topics: [] };
  }
  const matchedActions = actions.filter((action) => normalize(action.label).includes(normalizedQuery));
  const matchedTopics = topics
    .filter((topic) => normalize(topic.title).includes(normalizedQuery))
    .slice(0, TOPIC_RESULT_LIMIT);
  return { actions: matchedActions, topics: matchedTopics };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- commandPalette.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add kb-app/src/lib/commandPalette.ts kb-app/src/lib/commandPalette.test.ts
git commit -m "feat: add commandPalette action list and result filtering"
```

---

## Task 7: `CommandPalette.tsx` — global overlay, `App.tsx` mount, `ShortcutsHelp.tsx` doc line

**Files:**
- Create: `kb-app/src/components/palette/CommandPalette.tsx`
- Test: `kb-app/src/components/palette/CommandPalette.test.tsx`
- Modify: `kb-app/src/App.tsx` (mount `<CommandPalette />`)
- Modify: `kb-app/src/components/layout/ShortcutsHelp.tsx:8-15` (add one documentation line)

**Interfaces:**
- Consumes: `buildActionList`, `filterResults`, `PaletteAction` (Task 6); `setTheme`, `type Theme` from `kb-app/src/lib/theme.ts` (existing); `useNavigate` from `react-router-dom`.
- Produces: default-exported `CommandPalette` component, no props — reads the static topic dataset itself, mounted once in `App.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/components/palette/CommandPalette.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CommandPalette from './CommandPalette';
import topicsData from '../../data/topics.clean.json';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPalette() {
  return render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>,
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('is closed by default', () => {
    renderPalette();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on Ctrl+K from anywhere, including while a text input is focused', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <input aria-label="unrelated field" />
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.click(screen.getByLabelText('unrelated field'));
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows all five actions and no topics when opened with an empty query', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('option', { name: 'כרטיסיות' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'מבחן' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'מפת ידע' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'החלף ערכת נושא' })).toBeInTheDocument();
  });

  it('narrows results as the user types', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('combobox'), 'מבחן');
    expect(screen.getByRole('option', { name: 'מבחן' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'כרטיסיות' })).not.toBeInTheDocument();
  });

  it('typing a topic title shows it as a result', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    // fireEvent.change (not user.type) — real topic titles can contain
    // characters userEvent's keyboard syntax treats specially (e.g. `{`),
    // so setting the input value directly is the safe way to search by an
    // arbitrary title from the real dataset.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: topicsData[0].title } });
    expect(screen.getByRole('option', { name: topicsData[0].title })).toBeInTheDocument();
  });

  it('ArrowDown + Enter selects the second result and navigates', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    // Empty query -> actions in fixed order: home, flashcards, quiz, map, toggle-theme.
    await user.keyboard('{ArrowDown}{Enter}');
    expect(mockNavigate).toHaveBeenCalledWith('/flashcards');
  });

  it('Escape closes the palette and restores focus to the previously focused element', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <button type="button">trigger</button>
        <CommandPalette />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'trigger' });
    trigger.focus();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('selecting a page action navigates and closes the palette', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    await user.click(screen.getByRole('option', { name: 'מבחן' }));
    expect(mockNavigate).toHaveBeenCalledWith('/quiz');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selecting "toggle theme" flips the theme attribute and closes the palette', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    await user.click(screen.getByRole('option', { name: 'החלף ערכת נושא' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selecting a topic navigates to its reader and closes the palette', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: topicsData[0].title } });
    await user.click(screen.getByRole('option', { name: topicsData[0].title }));
    expect(mockNavigate).toHaveBeenCalledWith(`/topic/${encodeURIComponent(topicsData[0].id)}`);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- CommandPalette.test.tsx`
Expected: FAIL — `./CommandPalette` does not exist.

- [ ] **Step 3: Implement `CommandPalette.tsx`**

Create `kb-app/src/components/palette/CommandPalette.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import topicsRaw from '../../data/topics.clean.json';
import type { Topic } from '../../types';
import { buildActionList, filterResults, type PaletteAction } from '../../lib/commandPalette';
import { setTheme, type Theme } from '../../lib/theme';

const topics = topicsRaw as Topic[];
const allActions = buildActionList();

const ACTION_ROUTES: Record<string, string> = {
  home: '/',
  flashcards: '/flashcards',
  quiz: '/quiz',
  map: '/map',
};

function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

type PaletteItem = { kind: 'action'; action: PaletteAction } | { kind: 'topic'; topic: Topic };

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Global Cmd/Ctrl+K listener, mounted once. Unlike this app's bare `/`/`?`
  // shortcuts, a modifier combo never collides with normal typing, so no
  // "am I typing" guard is needed and the listener applies everywhere,
  // including while a text field is focused. The query/index reset on open
  // happens inside this same event-handler callback (not a bare useEffect
  // body), so it never trips react-hooks/set-state-in-effect.
  useEffect(() => {
    function handleGlobalKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((wasOpen) => {
          const next = !wasOpen;
          if (next) {
            setQuery('');
            setSelectedIndex(0);
          }
          return next;
        });
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Focus management only (ref writes + .focus() calls) — same pattern as
  // ShortcutsHelp.tsx. No setState here: this effect must not be the thing
  // that resets query/selectedIndex, or react-hooks/set-state-in-effect
  // would flag it.
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      inputRef.current?.focus();
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  const results = useMemo(() => filterResults(query, allActions, topics), [query]);
  const combined: PaletteItem[] = [
    ...results.actions.map((action): PaletteItem => ({ kind: 'action', action })),
    ...results.topics.map((topic): PaletteItem => ({ kind: 'topic', topic })),
  ];

  function close() {
    setOpen(false);
  }

  function runAction(action: PaletteAction) {
    if (action.id === 'toggle-theme') {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    } else {
      const path = ACTION_ROUTES[action.id];
      if (path) navigate(path);
    }
    close();
  }

  function openTopic(topic: Topic) {
    navigate(`/topic/${encodeURIComponent(topic.id)}`);
    close();
  }

  function activateIndex(index: number) {
    const item = combined[index];
    if (!item) return;
    if (item.kind === 'action') runAction(item.action);
    else openTopic(item.topic);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      // Single focusable element (the input) — pin focus to it, same
      // trapping strategy as ShortcutsHelp.tsx.
      event.preventDefault();
      inputRef.current?.focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((i) => (combined.length === 0 ? 0 : (i + 1) % combined.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((i) => (combined.length === 0 ? 0 : (i - 1 + combined.length) % combined.length));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      activateIndex(selectedIndex);
    }
  }

  if (!open) return null;

  return (
    <div onClick={close} className="fixed inset-0 z-30 flex justify-center bg-[var(--kb-overlay)] p-4 pt-24">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
        className="h-fit w-full max-w-lg rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] shadow-[var(--kb-shadow-lg)]"
      >
        <h2 id="command-palette-title" className="sr-only">
          חיפוש מהיר
        </h2>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-listbox"
          aria-autocomplete="list"
          aria-activedescendant={combined.length > 0 ? `command-palette-option-${selectedIndex}` : undefined}
          aria-label="חיפוש מהיר"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          placeholder="חפש נושא או פעולה..."
          className="min-h-11 w-full rounded-t-xl border-b border-[var(--kb-border)] bg-transparent px-4 text-[var(--kb-text)] outline-none"
        />
        <ul id="command-palette-listbox" role="listbox" aria-label="תוצאות" className="max-h-80 overflow-y-auto p-2">
          {combined.length === 0 && <li className="px-3 py-2 text-sm text-[var(--kb-muted)]">אין תוצאות</li>}
          {combined.map((item, index) => {
            const key = item.kind === 'action' ? `action-${item.action.id}` : `topic-${item.topic.id}`;
            const label = item.kind === 'action' ? item.action.label : item.topic.title;
            const isSelected = index === selectedIndex;
            return (
              <li
                key={key}
                id={`command-palette-option-${index}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => activateIndex(index)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex min-h-11 cursor-pointer items-center rounded-md px-3 text-[var(--kb-text)] ${
                  isSelected ? 'bg-[var(--kb-surface2)]' : ''
                }`}
              >
                {item.kind === 'topic' && (
                  <span aria-hidden="true" className="me-2 text-[var(--kb-muted)]">
                    📄
                  </span>
                )}
                {label}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `cd kb-app && npm run test -- CommandPalette.test.tsx`
Expected: PASS (11 tests)

- [ ] **Step 5: Mount `CommandPalette` in `App.tsx`**

Replace the entire contents of `kb-app/src/App.tsx` with:

```tsx
import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';
import Flashcards from './pages/Flashcards';
import Quiz from './pages/Quiz';
import KnowledgeMap from './pages/Map';
import { useUserDataStore } from './store/userDataStore';
import CommandPalette from './components/palette/CommandPalette';

export default function App() {
  const isLoaded = useUserDataStore((s) => s.isLoaded);

  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
  }, []);

  return (
    <>
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
        <Route path="/map" element={<KnowledgeMap />} />
      </Routes>
      {/* Mounted once, globally — safe here since main.tsx already wraps
          App in <BrowserRouter>, so useNavigate() works inside it. Renders
          nothing until Cmd/Ctrl+K opens it. */}
      <CommandPalette />
    </>
  );
}
```

(This only re-indents the existing `<Route>` block one level deeper for the new `<>` wrapper and adds the `CommandPalette` import/mount — every comment and route is otherwise unchanged from the current file.)

- [ ] **Step 6: Add the documentation line to `ShortcutsHelp.tsx`**

In `kb-app/src/components/layout/ShortcutsHelp.tsx`, replace:

```tsx
const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: '/', description: 'מיקוד בחיפוש' },
  { keys: 'Esc', description: 'ניקוי חיפוש / סגירת חלונית' },
  { keys: '?', description: 'הצגת קיצורי המקלדת האלה' },
  { keys: '↑ ↓ → ←', description: 'ניווט בין כרטיסים' },
  { keys: 'Enter', description: 'פתיחת נושא' },
  { keys: 'Home / End', description: 'מעבר לכרטיס הראשון / האחרון' },
];
```

with:

```tsx
const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: '/', description: 'מיקוד בחיפוש' },
  { keys: 'Esc', description: 'ניקוי חיפוש / סגירת חלונית' },
  { keys: '?', description: 'הצגת קיצורי המקלדת האלה' },
  { keys: '↑ ↓ → ←', description: 'ניווט בין כרטיסים' },
  { keys: 'Enter', description: 'פתיחת נושא' },
  { keys: 'Home / End', description: 'מעבר לכרטיס הראשון / האחרון' },
  { keys: 'Ctrl/Cmd + K', description: 'פתיחת חיפוש מהיר ופעולות' },
];
```

- [ ] **Step 7: Run the full test suite, typecheck, lint, and build**

Run: `cd kb-app && npm run test && npm run typecheck && npm run lint && npm run build`
Expected: all green — no regressions in any of the existing suites (`Flashcards.test.tsx`, `Quiz.test.tsx`, `Map.test.tsx`, `Header.test.tsx`, `Home.test.tsx`, etc.), the new `CommandPalette.test.tsx` passing, and a clean production build.

- [ ] **Step 8: Commit**

```bash
git add kb-app/src/components/palette/CommandPalette.tsx kb-app/src/components/palette/CommandPalette.test.tsx kb-app/src/App.tsx kb-app/src/components/layout/ShortcutsHelp.tsx
git commit -m "feat: add global command palette (Cmd/Ctrl+K)"
```

---

## Manual QA (post-implementation, not testable in jsdom)

- Cmd (Mac) vs Ctrl (Windows/Linux) keybind check on a real OS.
- Palette renders correctly atop every page (Home, Reader, Flashcards, Quiz, Map) in both RTL layout and both themes.
- Theme toggle from the palette visually matches the existing `ThemeToggle` button's effect.
- Keyboard-only end-to-end pass: open with Cmd/Ctrl+K from a focused text field, narrow results, arrow through them, activate with Enter, confirm focus returns correctly after Escape.
