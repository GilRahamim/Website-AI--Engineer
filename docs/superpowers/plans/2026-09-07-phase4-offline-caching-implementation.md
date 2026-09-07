# Phase 4, Sub-project #2 — Offline Caching of Topic Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a topic that's already been read once keep working offline on repeat visits — its HTML and images cached, with a clear message when a topic hasn't been cached and there's no network to fetch it.

**Architecture:** A `workbox.runtimeCaching` addition to the existing `VitePWA` config (`vite.config.ts`) makes the service worker cache `topic-content/*.html` and `topic-assets/*.png` the first time each is fetched (`CacheFirst`, no expiration — full dataset is ~5.9MB). `TopicReader.tsx`'s existing fetch-error branch gains a `navigator.onLine` check so an offline, never-cached topic shows a distinct message instead of the generic error.

**Tech Stack:** React 19, TypeScript, Vite, `vite-plugin-pwa` (already a devDependency from sub-project #1), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-07-phase4-offline-caching-design.md`

## Global Constraints

- `runtimeCaching` rules use `handler: 'CacheFirst'`, no `expiration` option (confirmed dataset size makes an eviction policy unnecessary).
- Two separate cache names: `topic-content` and `topic-assets` — not one shared cache.
- `globIgnores: ['**/topic-content/**', '**/topic-assets/**']` (from sub-project #1) stays unchanged — this sub-project only *adds* `runtimeCaching`, nothing else in the `workbox`/`VitePWA` config changes.
- The offline message only appears when `navigator.onLine` is `false` at the moment the fetch fails. Any other failure (404, real network error while online) keeps the existing generic `"שגיאה בטעינת התוכן."` message — this is additive, not a replacement of existing error handling.
- No new component, no new global state — `TopicReader.tsx` already owns its fetch and error branch; this only extends what it already tracks.
- No persistent "offline" indicator anywhere else in the UI — explicitly declined during design.

---

## Task 1: Runtime caching config in `vite.config.ts`

**Files:**
- Modify: `kb-app/vite.config.ts`
- Modify: `kb-app/src/pwaAssets.test.ts`

**Interfaces:**
- Produces: no new exported interface — this is a build-config change. Later tooling (browser DevTools, manual QA) observes its effect as two new Cache Storage entries (`topic-content`, `topic-assets`) after visiting a topic.

- [ ] **Step 1: Write the failing test**

In `kb-app/src/pwaAssets.test.ts`, replace:

```ts
const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, '..', 'public', 'manifest.webmanifest');
const indexHtmlPath = join(__dirname, '..', 'index.html');
```

with:

```ts
const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, '..', 'public', 'manifest.webmanifest');
const indexHtmlPath = join(__dirname, '..', 'index.html');
const viteConfigPath = join(__dirname, '..', 'vite.config.ts');
```

Then, at the end of the same file, replace the last 5 lines:

```ts
  it('declares iOS web-app-capable and apple-touch-icon', () => {
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/icon-192.png" />');
  });
});
```

with:

```ts
  it('declares iOS web-app-capable and apple-touch-icon', () => {
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/icon-192.png" />');
  });
});

describe('vite.config.ts runtime caching', () => {
  const configSource = readFileSync(viteConfigPath, 'utf-8');

  it('caches topic-content HTML with CacheFirst', () => {
    expect(configSource).toContain("cacheName: 'topic-content'");
    expect(configSource).toMatch(/topic-content.*\.html/);
  });

  it('caches topic-assets images with CacheFirst', () => {
    expect(configSource).toContain("cacheName: 'topic-assets'");
    expect(configSource).toMatch(/topic-assets.*\.png/);
  });

  it('uses CacheFirst for both runtime caching rules', () => {
    const matches = configSource.match(/handler: 'CacheFirst'/g);
    expect(matches).toHaveLength(2);
  });
});
```

(`kb-app/src/pwaAssets.test.ts` currently ends right after the `index.html PWA tags` block's closing `});` — these two edits are the entire change to this file.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- pwaAssets.test.ts`
Expected: the two pre-existing describe blocks (`PWA manifest`, `index.html PWA tags`) still PASS; the new `vite.config.ts runtime caching` block's 3 tests FAIL (no `runtimeCaching`/`CacheFirst` text exists in `vite.config.ts` yet).

- [ ] **Step 3: Add `runtimeCaching` to `vite.config.ts`**

Replace the entire contents of `kb-app/vite.config.ts` with:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // A static public/manifest.webmanifest is already shipped (see
      // Task 2) — this plugin only needs to generate the service worker,
      // not a manifest of its own.
      manifest: false,
      includeAssets: ['favicon.png', 'icons/*.png'],
      // Lets the service worker be exercised under `npm run dev`, not
      // only `npm run build && npm run preview`.
      devOptions: { enabled: true },
      workbox: {
        // workbox-build's own default globPatterns ("**/*.{js,wasm,css,html}"
        // against the whole dist/ tree) would otherwise sweep every
        // topic-content/*.html file into the install-time precache manifest
        // (confirmed: 160 files, ~1.4MB) — precaching topic content/images
        // outright isn't what we want (below is the deliberate, on-demand
        // alternative), so both directories stay excluded from the precache.
        globIgnores: ['**/topic-content/**', '**/topic-assets/**'],
        // Runtime caching: once a topic's HTML or an image has been
        // fetched once (the user opened that topic while online), every
        // future request for that exact URL is served from the cache —
        // works fully offline. No expiration cap: the full dataset (160
        // HTML files + 240 images) is ~5.9MB total, small enough that an
        // eviction policy isn't worth the complexity.
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
    }),
  ],
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- pwaAssets.test.ts`
Expected: PASS (9 tests total: 2 + 4 pre-existing, 3 new)

- [ ] **Step 5: Verify typecheck and build**

Run: `cd kb-app && npm run typecheck`
Expected: exits 0.

Run: `cd kb-app && npm run build`
Expected: exits 0. The build's printed Workbox summary should still show a small precache entry count (around 8, same as sub-project #1 — `runtimeCaching` does not add anything to the *precache* manifest, it only registers routes the service worker matches at request time).

- [ ] **Step 6: Run the full test suite to confirm no regression**

Run: `cd kb-app && npm run test`
Expected: PASS, same test count as before this task plus the 3 new tests (this task touches no other test file).

- [ ] **Step 7: Commit**

```bash
git add kb-app/vite.config.ts kb-app/src/pwaAssets.test.ts
git commit -m "feat: cache topic content and images for offline reading"
```

---

## Task 2: Offline-fallback message in `TopicReader.tsx`

**Files:**
- Modify: `kb-app/src/components/reader/TopicReader.tsx`
- Modify: `kb-app/src/components/reader/TopicReader.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 — this task is independent of the `vite.config.ts` change; it only refines what `TopicReader` shows when its own `fetch()` fails, which happens whether or not that fetch would have been served from a Task-1 cache.

- [ ] **Step 1: Write the failing test**

In `kb-app/src/components/reader/TopicReader.test.tsx`, replace:

```tsx
  it('renders an error state when the content fetch rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    renderWithRouter();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('שגיאה בטעינת התוכן'));
  });

  it('renders status and favorite controls for the topic', () => {
```

with:

```tsx
  it('renders an error state when the content fetch rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    renderWithRouter();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('שגיאה בטעינת התוכן'));
  });

  it('renders an offline-specific message when the fetch rejects while navigator.onLine is false', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    global.fetch = vi.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('אין חיבור לאינטרנט — ניתן לצפות רק בנושאים שנצפו כבר.'),
    );
  });

  it('renders status and favorite controls for the topic', () => {
```

(The file's existing `afterEach(() => vi.restoreAllMocks())` already restores the `navigator.onLine` spy after this test — no manual restore needed, matching the file's existing convention. Everything else in the file — imports, the `topic`/`relatedTopic` fixtures, `beforeEach`, `renderWithRouter`, and every other test — stays exactly as-is.)

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `cd kb-app && npm run test -- TopicReader.test.tsx`
Expected: the pre-existing tests (including the unmodified "renders an error state when the content fetch rejects", which runs with `navigator.onLine` at its jsdom default of `true`) still PASS; the new offline test FAILS — the component doesn't yet render a different message when offline.

- [ ] **Step 3: Add the offline branch to `TopicReader.tsx`**

Replace the entire contents of `kb-app/src/components/reader/TopicReader.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Topic } from '../../types';
import RelatedTopics from './RelatedTopics';
import TopicStatusButton from '../topic/TopicStatusButton';
import TopicFavoriteButton from '../topic/TopicFavoriteButton';
import TopicNotes from '../topic/TopicNotes';

interface TopicReaderProps {
  topic: Topic;
  topicsById: Map<string, Topic>;
}

type ContentState =
  | { path: string; status: 'loaded'; html: string }
  | { path: string; status: 'error'; offline: boolean };

export default function TopicReader({ topic, topicsById }: TopicReaderProps) {
  const [content, setContent] = useState<ContentState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(topic.contentPath)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load content: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setContent({ path: topic.contentPath, status: 'loaded', html: text });
      })
      .catch(() => {
        // navigator.onLine is a coarse signal — `true` doesn't guarantee
        // real connectivity, but `false` reliably means no network, which
        // is exactly the asymmetry needed here: distinguish "definitely
        // offline" from any other fetch failure, not detect flaky
        // connections precisely.
        if (!cancelled) setContent({ path: topic.contentPath, status: 'error', offline: !navigator.onLine });
      });
    return () => {
      cancelled = true;
    };
  }, [topic.contentPath]);

  const isCurrent = content?.path === topic.contentPath;
  const html = isCurrent && content.status === 'loaded' ? content.html : null;
  const error = isCurrent && content.status === 'error' ? content : null;

  return (
    <article className="mx-auto max-w-3xl p-4">
      <nav aria-label="breadcrumb" className="mb-2 flex items-center gap-2 text-sm text-[var(--kb-muted)]">
        <Link to="/" className="hover:underline">
          מסד ידע
        </Link>
        <span aria-hidden="true">›</span>
        <span>{topic.module_label}</span>
      </nav>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="kb-category-chip w-fit" data-category={topic.category}>
          {topic.category_label}
        </span>
        <div className="flex items-center gap-2">
          <TopicStatusButton topicId={topic.id} size="lg" />
          <TopicFavoriteButton topicId={topic.id} size="lg" />
        </div>
      </div>
      <h1 className="mb-2 text-2xl font-extrabold text-[var(--kb-text)]">{topic.title}</h1>
      <p className="mb-6 text-[var(--kb-text2)]">{topic.definition}</p>
      {html === null ? (
        error ? (
          <p role="alert">
            {error.offline ? 'אין חיבור לאינטרנט — ניתן לצפות רק בנושאים שנצפו כבר.' : 'שגיאה בטעינת התוכן.'}
          </p>
        ) : (
          <p role="status">טוען תוכן…</p>
        )
      ) : (
        <div className="kb-topic-content" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <TopicNotes topicId={topic.id} />
      <RelatedTopics relatedIds={topic.related_match} topicsById={topicsById} />
    </article>
  );
}
```

(Only two things changed from the previous version: `ContentState`'s error variant now carries `offline: boolean`, set from `!navigator.onLine` in the `catch` handler; and the `error` variable now holds the full error `ContentState` object — instead of a plain boolean — so the JSX can branch on `error.offline`. Everything else, including the exact `isCurrent`/`html` pattern, is unchanged.)

- [ ] **Step 4: Run tests to verify they all pass**

Run: `cd kb-app && npm run test -- TopicReader.test.tsx`
Expected: PASS (8 tests: 7 pre-existing + 1 new)

- [ ] **Step 5: Run the full verification suite**

Run: `cd kb-app && npm run test && npm run typecheck && npm run lint && npm run build`
Expected: all four green.

- [ ] **Step 6: Commit**

```bash
git add kb-app/src/components/reader/TopicReader.tsx kb-app/src/components/reader/TopicReader.test.tsx
git commit -m "feat: show a distinct message for offline, never-cached topics"
```

---

## Manual QA (post-implementation, not testable in jsdom)

- `npm run build && npm run preview`, open a topic (this caches it), then DevTools → Network → Offline, then reload that same topic — it should still render, including its image(s).
- While still offline, open a *different*, never-visited topic — confirm the new Hebrew offline message appears (`אין חיבור לאינטרנט — ניתן לצפות רק בנושאים שנצפו כבר.`), not the generic error.
- Confirm DevTools → Application → Cache Storage shows two new caches, `topic-content` and `topic-assets`, each containing the entries for topics actually visited.
- Light theme, dark theme, RTL check on the new offline message.
- No regression to sub-project #1: install button still works, precache entry count is still small (~8 entries, not 168) after `npm run build`.
