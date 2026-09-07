# Phase 4, Sub-project #3 — Performance & Code-Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the app's single 719.60KB (minified) JS bundle by splitting `Flashcards`, `Quiz`, and `Map` into their own lazily-loaded chunks, and remove a dead font reference left over from sub-project #1.

**Architecture:** `App.tsx` converts three of its five routes to `React.lazy()` imports behind one shared `Suspense` boundary; `Home`/`Reader` stay eager. A one-line CSS change removes a `font-family` reference to a font that was never actually loaded.

**Tech Stack:** React 19 (`lazy`/`Suspense`), TypeScript, Vite, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-07-phase4-code-splitting-design.md`

## Global Constraints

- `Home` and `Reader` stay eager imports — never lazy-loaded.
- `Flashcards`/`Quiz`/`Map`'s existing hydration-hazard comments and behavior (the `key={String(isLoaded)}` remount trick on `Flashcards`, Quiz's click-time-only store read, Map's total independence from `userDataStore`) are preserved exactly — `React.lazy()` only defers fetching the module, it does not change when or how a component mounts.
- One shared `<Suspense>` boundary wraps the whole `<Routes>` block — not one per lazy route.
- The `RouteFallback` fallback element uses `role="status"` and only `--kb-*` tokens (`text-[var(--kb-muted)]`) — no hardcoded colors.
- `npm run build` must produce no "chunks are larger than 500 kB" warning when this sub-project is done — achieved via a documented `build.chunkSizeWarningLimit` adjustment in `vite.config.ts`, not by forcing the bundle itself under an exact KB number (see the design spec's Section 3 correction: splitting Map/Flashcards/Quiz did not bring the remaining bundle, dominated by Home/Reader's eager static JSON, under 500KB on its own).
- No change to `vite.config.ts`'s `workbox` block, the manifest, icons, or the offline-caching rules from sub-projects #1-#2.

---

## Task 1: Code-split `Flashcards`/`Quiz`/`Map` in `App.tsx`

**Files:**
- Modify: `kb-app/src/App.tsx`
- Modify: `kb-app/src/App.test.tsx`

**Interfaces:**
- Produces: `RouteFallback` — a private, unexported component local to `App.tsx`, not consumed anywhere else.

- [ ] **Step 1: Modify `App.tsx`**

Replace the entire contents of `kb-app/src/App.tsx` with:

```tsx
import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';
import { useUserDataStore } from './store/userDataStore';
import CommandPalette from './components/palette/CommandPalette';

const Flashcards = lazy(() => import('./pages/Flashcards'));
const Quiz = lazy(() => import('./pages/Quiz'));
const KnowledgeMap = lazy(() => import('./pages/Map'));

function RouteFallback() {
  return (
    <p role="status" className="p-8 text-center text-[var(--kb-muted)]">
      טוען…
    </p>
  );
}

export default function App() {
  const isLoaded = useUserDataStore((s) => s.isLoaded);

  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
  }, []);

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
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
              changes, so no extra remount happens. This is unrelated to (and
              unaffected by) the React.lazy() code-splitting below — lazy()
              only defers fetching the module, not when the component mounts. */}
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
      </Suspense>
      {/* Mounted once, globally — safe here since main.tsx already wraps
          App in <BrowserRouter>, so useNavigate() works inside it. Renders
          nothing until Cmd/Ctrl+K opens it. */}
      <CommandPalette />
    </>
  );
}
```

- [ ] **Step 2: Run `App.test.tsx` to confirm it now fails**

Run: `cd kb-app && npm run test -- App.test.tsx`
Expected: FAIL — 4 of the 6 existing tests break ("renders the Flashcards page...", "rebuilds the Flashcards queue...", "renders the Quiz page...", "renders the Map page..."), each because `screen.getByRole(...)` now runs before the lazy chunk has resolved (only the `RouteFallback` text is in the DOM at that synchronous point). "renders Home..." and "renders the Reader..." still pass — those routes stayed eager.

- [ ] **Step 3: Update `App.test.tsx`'s assertions to async**

In `kb-app/src/App.test.tsx`, replace:

```tsx
  it('renders the Flashcards page at "/flashcards"', () => {
    render(
      <MemoryRouter initialEntries={['/flashcards']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'כרטיסיות' })).toBeInTheDocument();
  });

  it('rebuilds the Flashcards queue once the store finishes loading after mounting pre-hydration', () => {
    const now = Date.now();
    const farFuture = now + 1000 * 60 * 60 * 24 * 365;
    useUserDataStore.setState({
      progress: new Map(),
      favorites: new Set(),
      recents: [],
      notes: new Map(),
      srsCards: new Map(),
      isLoaded: false,
    });

    render(
      <MemoryRouter initialEntries={['/flashcards']}>
        <App />
      </MemoryRouter>,
    );

    act(() => {
      const allNotDue = new Map(
        topicsData.map((t) => [
          t.id,
          { topicId: t.id, ease: 2.5, intervalDays: 365, dueAt: farFuture, reps: 1, lapses: 0, updatedAt: now },
        ]),
      );
      useUserDataStore.setState({ srsCards: allNotDue, isLoaded: true });
    });

    expect(screen.getByRole('status')).toHaveTextContent('אין כרטיסים לחזרה');
  });

  it('renders the Quiz page at "/quiz"', () => {
    render(
      <MemoryRouter initialEntries={['/quiz']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'מבחן' })).toBeInTheDocument();
  });

  it('renders the Map page at "/map"', () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'מפת ידע' })).toBeInTheDocument();
  });
```

with:

```tsx
  it('renders the Flashcards page at "/flashcards"', async () => {
    render(
      <MemoryRouter initialEntries={['/flashcards']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'כרטיסיות' })).toBeInTheDocument();
  });

  it('rebuilds the Flashcards queue once the store finishes loading after mounting pre-hydration', async () => {
    const now = Date.now();
    const farFuture = now + 1000 * 60 * 60 * 24 * 365;
    useUserDataStore.setState({
      progress: new Map(),
      favorites: new Set(),
      recents: [],
      notes: new Map(),
      srsCards: new Map(),
      isLoaded: false,
    });

    render(
      <MemoryRouter initialEntries={['/flashcards']}>
        <App />
      </MemoryRouter>,
    );

    // Wait for the lazy Flashcards chunk to resolve and mount (key="false")
    // before flipping isLoaded — otherwise the store update below could
    // race the initial lazy resolution instead of triggering a clean,
    // separate remount via the key change.
    await screen.findByRole('heading', { name: 'כרטיסיות' });

    act(() => {
      const allNotDue = new Map(
        topicsData.map((t) => [
          t.id,
          { topicId: t.id, ease: 2.5, intervalDays: 365, dueAt: farFuture, reps: 1, lapses: 0, updatedAt: now },
        ]),
      );
      useUserDataStore.setState({ srsCards: allNotDue, isLoaded: true });
    });

    expect(screen.getByRole('status')).toHaveTextContent('אין כרטיסים לחזרה');
  });

  it('renders the Quiz page at "/quiz"', async () => {
    render(
      <MemoryRouter initialEntries={['/quiz']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'מבחן' })).toBeInTheDocument();
  });

  it('renders the Map page at "/map"', async () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'מפת ידע' })).toBeInTheDocument();
  });
```

(No new imports needed — `screen.findByRole` is already available on the `screen` object imported at the top of this file. The `act()` block after the `await` stays synchronous: by the time it runs, `Flashcards`'s lazy module promise has already resolved once, so React's `lazy()` module cache makes the `key`-triggered remount render synchronously within `act()`, with no new suspense — the final `screen.getByRole('status')` assertion does not need to become async.)

- [ ] **Step 4: Run tests to verify they all pass**

Run: `cd kb-app && npm run test -- App.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full verification suite and check the build output**

Run: `cd kb-app && npm run test && npm run typecheck && npm run lint`
Expected: all three green, same total test count as before this task (this task only touches `App.tsx`/`App.test.tsx`).

Run: `cd kb-app && npm run build`
Expected: exits 0, and the printed output does **not** contain the line `(!) Some chunks are larger than 500 kB after minification.` Confirm by checking the per-chunk sizes printed: there should now be a separate chunk for each of `Flashcards`, `Quiz`, and `Map` (look for three new `dist/assets/*.js` entries beyond the main `index-*.js` bundle), and the main `index-*.js` bundle's size should have dropped well below 500 kB (the previous single-bundle build was 719.60 kB).

- [ ] **Step 6: Commit**

```bash
git add kb-app/src/App.tsx kb-app/src/App.test.tsx
git commit -m "feat: code-split Flashcards/Quiz/Map behind React.lazy"
```

---

## Task 2: Remove the dead Heebo font reference

**Files:**
- Modify: `kb-app/src/styles/index.css`

**Interfaces:**
- None — this is a one-line, purely cosmetic CSS correction with zero behavioral effect (browsers already render with `system-ui` today, since `'Heebo'` never resolved to any loaded font).

- [ ] **Step 1: Edit `index.css`**

In `kb-app/src/styles/index.css`, replace:

```css
  font-family: 'Heebo', system-ui, sans-serif;
```

with:

```css
  font-family: system-ui, sans-serif;
```

- [ ] **Step 2: Run the full test suite to confirm no regression**

Run: `cd kb-app && npm run test && npm run typecheck && npm run lint && npm run build`
Expected: all four green, identical test count and pass/fail results to Task 1's final state (this is a CSS-only change with no test coverage of its own, since there is no observable behavior change to assert — the font already rendered as `system-ui` before this edit).

- [ ] **Step 3: Commit**

```bash
git add kb-app/src/styles/index.css
git commit -m "chore: remove dead Heebo font-family reference"
```

---

## Manual QA (post-implementation, not testable in jsdom)

- `npm run preview`, open the browser DevTools Network tab, hard-reload `/` — confirm no request for a `Flashcards`/`Quiz`/`Map`-named chunk.
- Navigate to `/flashcards` via an in-app link/nav click — confirm a new JS chunk downloads at that moment. The previous page's UI is expected to stay visible during the transition rather than showing the `RouteFallback` message (react-router-dom 7 wraps navigations in `React.startTransition`, which keeps prior content on screen instead of swapping to the Suspense fallback) — this is correct, better UX, not a bug to chase.
- Open `/flashcards` directly via a hard page load (e.g. typing the URL, or a fresh `npm run preview` tab) — confirm the `RouteFallback` "טוען…" message IS visible briefly here, since the `Suspense` boundary is mounting fresh with no prior content to keep showing.
- Repeat for `/quiz` and `/map`.
- Light theme, dark theme, RTL check on the `RouteFallback` message (trigger a slow network via DevTools throttling to see it clearly if it flashes too fast otherwise).
- Confirm no regression to Phase 3 features (Flashcards SRS grading, Quiz answering, Map node click-through) or Phase 4 sub-projects #1-#2 (install button still works; a previously-cached topic still works offline).
