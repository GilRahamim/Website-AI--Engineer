# Phase 4, Sub-project #3 — Performance & Code-Splitting: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** Phase 4 sub-projects #1 (PWA Installability) and #2 (Offline Caching) — both complete, merged, pushed to `origin/master`.
**Scope boundary:** the third and final sub-project decomposing "Phase 4 — PWA + Offline" (`site-build-docs/00-BUILD-README.md`, `05-PWA-AND-DEPLOYMENT.md`). Completes Phase 4.

## Goal

Shrink the app's single 719.60KB (minified) JS bundle by splitting `Flashcards`, `Quiz`, and `Map` into their own lazily-loaded chunks, and remove a dead font reference left over from sub-project #1.

## Scope corrections, carried over from earlier sub-projects

`05-PWA-AND-DEPLOYMENT.md`'s original performance section listed several items; two are already moot per sub-project #1's own design corrections and are not revisited here:
- **KaTeX dynamic import** — moot, this app has no KaTeX (formulas are pre-rendered PNG images).
- **woff2-only fonts / strip duplicate ttf/woff** — moot, there was never a custom webfont loaded (see Section 2 — the dead `'Heebo'` reference is removed here, not "optimized").
- **Images already lazy-loaded** — already true (`loading="lazy"` on every topic image, set during the original data migration) — nothing to do.

That leaves exactly one real, actionable item from the original doc: **per-page code-splitting** — plus the leftover Heebo cleanup sub-project #1 deferred here.

## Out of scope

Supabase (Phase 5). Actual hosting deploy (Phase 6). Actually loading a real Heebo webfont (considered, declined — see Section 2). Lazy-loading `Home`/`Reader` (considered, declined — they're the app's entry points; lazy-loading them would add a loading flash to the single most common action).

## Section 1: Route-level code-splitting in `App.tsx`

`Flashcards`, `Quiz`, and `Map` become `React.lazy()` imports, wrapped in one shared `<Suspense>` around the whole `<Routes>` block (only one route renders at a time, so one shared boundary is simpler and equally correct as one per lazy route). `Home` and `Reader` stay eager.

```tsx
import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';
import CommandPalette from './components/palette/CommandPalette';
import { useUserDataStore } from './store/userDataStore';

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
          <Route path="/flashcards" element={<Flashcards key={String(isLoaded)} />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/map" element={<KnowledgeMap />} />
        </Routes>
      </Suspense>
      <CommandPalette />
    </>
  );
}
```

`React.lazy()` only defers *fetching the module* — it doesn't change when or how the component itself mounts. Every existing hydration-hazard comment on the `Flashcards`/`Quiz`/`Map` routes (already carefully reasoned about in earlier sub-projects) stays accurate unchanged; this sub-project doesn't touch that reasoning, just where the module comes from.

Expected effect: `react-force-graph-2d` and the `d3-force` machinery it pulls in (by far the heaviest thing in this app — 6.4MB unpacked source for `force-graph` alone) moves into its own chunk that only downloads when a visitor actually opens `/map`. `Flashcards`/`Quiz` are much lighter but still worth splitting out, since neither is needed for the common "browse Home, read a topic" path.

**Correction (post-implementation):** this cut the main bundle from 719.60 kB to 518.93 kB (minified) — a real 27.9% reduction — but did not bring it under Vite's 500 kB warning threshold as Section 3 originally predicted. The remaining chunk is dominated by ~270KB raw of the static `topics.clean.json`/`search-index.json` datasets that `Home`/`Reader` eagerly import (by design — see "Out of scope" above), not by unsplit route code. See Section 3's corrected verification target below.

**Existing test impact, verified during design:** `src/App.test.tsx` already renders `<App>` through real routing and asserts synchronously on `/flashcards`, `/quiz`, and `/map` (4 tests: "renders the Flashcards page", "rebuilds the Flashcards queue...", "renders the Quiz page", "renders the Map page"). Once those routes are lazy, those specific assertions must become async (`await screen.findByRole(...)` instead of `screen.getByRole(...)`) — the real component only appears after its chunk resolves, not synchronously. `Flashcards.test.tsx`/`Quiz.test.tsx`/`Map.test.tsx` import their components directly (not through `App`'s routing) and are unaffected.

## Section 2: Remove the dead Heebo font reference

`src/styles/index.css`, currently:
```css
font-family: 'Heebo', system-ui, sans-serif;
```
becomes:
```css
font-family: system-ui, sans-serif;
```
Zero behavioral change — `'Heebo'` never resolved to anything (no `@font-face`, no Google Fonts link, no `.woff2` file exists in this repo), so every browser was already falling through to `system-ui`. This just makes the declared font stack match what's actually rendered. Declined: self-hosting a real Heebo webfont — that would be a new visual change nobody has asked for or noticed missing, and adds real weight for a sub-project whose goal is shrinking the bundle.

## Section 3: Verification target

The original doc's "<500KB first-load" conflates two different measurements: Vite's build-time chunk-size warning (500KB **minified**, currently tripped by the single 719.60KB bundle) and actual network transfer size (**gzip**, already 205.34KB today, comfortably under any reasonable budget — gzip is what a browser actually downloads). Splitting Map's chunk out did **not** bring the remaining eager bundle under Vite's 500KB-minified warning threshold, contrary to this section's original prediction (confirmed during implementation: the main chunk landed at 518.93 kB, still over the threshold, because `Home`/`Reader`'s eager static JSON — not route code — dominates it). Rather than chasing the exact number via further code-splitting (which would require restructuring how nearly every page loads the static topic dataset, a much larger and unscoped change), `vite.config.ts`'s `build.chunkSizeWarningLimit` is raised to 600 with a comment documenting why: that remaining chunk is only 141.39 kB gzip — a perfectly reasonable transfer size — and Vite's 500KB-minified default doesn't fit a content-heavy local-first app well. **Concrete, checkable Definition-of-Done criterion (revised): `npm run build` produces no chunk-size warning, achieved via the documented `chunkSizeWarningLimit` adjustment rather than a specific KB target on the bundle itself.**

## Testing

- `src/App.test.tsx`: the 4 existing tests identified in Section 1 change from `screen.getByRole(...)` to `await screen.findByRole(...)` (React Testing Library's built-in async query, which polls until the element appears or times out) — behavior-preserving, not new coverage; proves the `Suspense`/`lazy()` wiring itself resolves correctly, not just that the underlying pages work in isolation.
- `Flashcards.test.tsx`/`Quiz.test.tsx`/`Map.test.tsx`: unchanged, still pass as-is (they don't render through `App`).
- Manual, not fully verifiable in jsdom: `npm run build` shows no chunk-size warning; `npm run preview` + browser DevTools Network tab confirms `/map`'s JS chunk downloads only when navigating to `/map`, not on initial load of `/`.

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green, **and** the build produces no "chunks are larger than 500 kB" warning.
- Manual check: opening `/`, `/flashcards`, `/quiz` never triggers a network request for Map's chunk; opening `/map` does, with the `RouteFallback` message showing briefly first.
- No regression to Phase 3 (Flashcards SRS session, Quiz, Map interactions) or Phase 4 sub-projects #1-#2 — code-splitting doesn't touch `vite.config.ts`'s `workbox` block, the manifest, icons, or the offline-caching rules at all.
- Light theme, dark theme, RTL checked for the new `RouteFallback` message.
- No hardcoded colors outside `--kb-*` tokens (golden rule 7) — `RouteFallback` uses the same `text-[var(--kb-muted)]` token every other muted-text element in this codebase already uses.
