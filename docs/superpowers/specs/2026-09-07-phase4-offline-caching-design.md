# Phase 4, Sub-project #2 — Offline Caching of Topic Content: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** Phase 4 sub-project #1 (PWA Installability) — complete, merged, pushed to `origin/master`.
**Scope boundary:** the second of three sub-projects decomposing "Phase 4 — PWA + Offline" (`site-build-docs/00-BUILD-README.md`, `05-PWA-AND-DEPLOYMENT.md`). Sub-project #3 (performance/code-splitting) comes after this one.

## Goal

Let a topic that's already been read once keep working offline on repeat visits — its HTML and images cached, with a clear message when a topic hasn't been cached and there's no network to fetch it.

## Scope correction, carried over from sub-project #1's final review

Sub-project #1's spec originally assumed Home/search needed this sub-project too. That assumption was wrong and already corrected in sub-project #1's own docs: `topics.clean.json`/`modules.json`/`search-index.json` are `import`ed as ES modules, so Vite inlines them into the main JS bundle — which sub-project #1's app-shell precache already includes. **Home and search already work offline today.** The only remaining gap is `TopicReader.tsx`'s per-topic `fetch(topic.contentPath)` (160 HTML files, 1.2MB total) and the `<img>` tags inside that HTML pointing at `topic-assets/*.png` (240 files, 4.7MB total, largest ~240KB) — neither is fetched until a topic is opened, and neither is cached today (sub-project #1 explicitly excluded both directories from the precache via `globIgnores`, deferring them here).

This narrows the sub-project to two small, well-bounded changes: a runtime-caching rule, and one error-message branch.

## Out of scope

Supabase (Phase 5). Performance/code-splitting and the `<500KB` first-load target (sub-project #3). Actual hosting deploy (Phase 6). A persistent "you are offline" indicator anywhere in the UI (considered, declined — the per-topic error message is enough). Cache eviction/expiration limits (the full dataset is ~5.9MB; `CacheFirst` with no cap is fine at this size — see Section 1).

## Section 1: Runtime caching config

Extend the existing `workbox` block in `kb-app/vite.config.ts` (which already has `globIgnores` from sub-project #1 — unchanged) with a `runtimeCaching` array:

```ts
workbox: {
  globIgnores: ['**/topic-content/**', '**/topic-assets/**'],
  runtimeCaching: [
    {
      urlPattern: /\/topic-content\/.+\.html$/,
      handler: 'CacheFirst',
      options: { cacheName: 'topic-content' },
    },
    {
      urlPattern: /\/topic-assets\/.+\.png$/,
      handler: 'CacheFirst',
      options: { cacheName: 'topic-assets' },
    },
  ],
},
```

`CacheFirst`: once a topic's HTML or an image has been fetched once (the user opened that topic while online), every future request for that exact URL is served from the cache — no network round-trip required, works fully offline. A topic never opened simply isn't cached yet; its `fetch()` in `TopicReader.tsx` fails offline exactly as it does today, handled by Section 2. No `expiration` option — confirmed dataset size (~5.9MB total, even if every topic is eventually read) makes an eviction policy unnecessary complexity for this app. Two separate cache names (not one) keep HTML and images independently inspectable/clearable in DevTools, at no extra cost.

Both `urlPattern` regexes are scoped to their own directory and extension (`.html` under `topic-content/`, `.png` under `topic-assets/`) — they cannot accidentally match anything else Workbox routes (the app shell's own JS/CSS/HTML, matched by the precache manifest instead, never reaches `runtimeCaching` for those files).

## Section 2: Offline-fallback UX in `TopicReader.tsx`

Today, any `fetch()` failure — network error, 404, anything — lands in one generic `catch` and renders `"שגיאה בטעינת התוכן."`. This section distinguishes "definitely offline, and this topic was never cached" from any other failure.

`ContentState`'s error variant gains an `offline: boolean` field:
```tsx
type ContentState =
  | { path: string; status: 'loaded'; html: string }
  | { path: string; status: 'error'; offline: boolean };
```

The `fetch().catch(...)` handler records `navigator.onLine` at the moment of failure:
```tsx
.catch(() => {
  if (!cancelled) setContent({ path: topic.contentPath, status: 'error', offline: !navigator.onLine });
});
```

Rendering branches on it:
```tsx
error ? (
  <p role="alert">
    {content.offline ? 'אין חיבור לאינטרנט — ניתן לצפות רק בנושאים שנצפו כבר.' : 'שגיאה בטעינת התוכן.'}
  </p>
) : (
  <p role="status">טוען תוכן…</p>
)
```

`navigator.onLine` is a coarse signal — `true` doesn't guarantee real connectivity, but `false` reliably means no network — which is exactly the asymmetry this needs: distinguishing "definitely offline" from "some other error," not detecting flaky connections precisely. One file changes (`TopicReader.tsx`), no new component, no new state management; `TopicReader` already owns the fetch and its error branch.

Declined: a persistent offline indicator elsewhere in the UI (header badge, banner). The per-topic message covers the only place offline state actually changes what the user sees; a global indicator was considered and explicitly declined during design as unnecessary scope for what this sub-project needs to solve.

## Testing

- `TopicReader.test.tsx` (or a `Reader.test.tsx` addition, matching wherever `TopicReader`'s existing fetch-mock tests live): mock `fetch` to reject with `navigator.onLine` stubbed `false` → asserts the new offline message; mock `fetch` to reject with `navigator.onLine` stubbed `true` → asserts the original generic error message (regression check proving the existing behavior is preserved, not replaced).
- `vite.config.ts`'s `runtimeCaching` array is not unit-testable — Workbox's actual caching behavior only exists inside a real, installed service worker, not in jsdom. Its *presence* is, though: a `pwaAssets.test.ts`-style test (same pattern sub-project #1 already established there) reads `vite.config.ts`'s source text via `readFileSync` and asserts the `runtimeCaching` array's two `urlPattern` sources and `cacheName`s appear in it — catching an accidental deletion or typo without needing real service-worker behavior. Required, not optional, matching the precedent already in this codebase.
- Manual, not testable in jsdom: `npm run build && npm run preview`; open a topic (caches it); DevTools → Network → Offline; reload that same topic — it still renders, including its image(s); open a *different*, never-visited topic while offline — see the new Hebrew offline message, not the generic error.

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- Manual offline check above passes for both a previously-read topic (works) and a never-read topic (clear offline message, not a generic error).
- No regression to sub-project #1 — `globIgnores` and every other existing `workbox`/`VitePWA` option stay unchanged; this only *adds* `runtimeCaching`.
- Light theme, dark theme, RTL checked for the new error message.
- No hardcoded colors outside `--kb-*` tokens (golden rule 7) — the new message uses the same `role="alert"` element and surrounding styles `TopicReader.tsx` already uses for its error state, no new styling introduced.

## Post-final-review addendum: cache staleness is an accepted tradeoff

The final whole-branch review flagged that `CacheFirst` with no `expiration` on `topic-content/*.html` means a cached topic's HTML is pinned in the browser's Cache Storage indefinitely — its URL is a hash of the topic's *id*, not its content, so a future correction to that topic's text would never reach a reader who already cached it, short of a manual site-data clear or a cache-name bump.

This is accepted as-is, not fixed, for two reasons: (1) it's a direct consequence of the "no expiration cap" choice already made deliberately during this sub-project's design (the ~5.9MB total dataset doesn't need eviction, and `StaleWhileRevalidate` would silently change that approved decision without being asked); (2) golden rule 1 (`kb-app/CLAUDE.md`: "התוכן קדוש. אין לשנות טקסט/הגדרות/נוסחאות של נושאים" — content is sacred, topic text/definitions/formulas must not be changed) already means this app's own rules treat post-migration topic content as immutable. A "content correction" that this caching behavior would block is exactly the kind of change golden rule 1 already prohibits outside the one-time migration step.

If a genuine need to update already-shipped topic content ever arises (a data pipeline bug, not a content edit), the fix is a one-line cache-name bump in `vite.config.ts` (e.g. `topic-content` → `topic-content-v2`), not a change to the caching strategy itself.
