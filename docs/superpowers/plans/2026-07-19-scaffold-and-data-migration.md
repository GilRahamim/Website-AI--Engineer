# Scaffold + Data Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `kb-app` Vite + React + TypeScript project (Phase 0 of the build) and produce the migrated, lightweight content data (`topics.clean.json`, `search-index.json`, extracted images/HTML) from `topics.raw.json` (Phase 1).

**Architecture:** Vite + React 18 + TypeScript app scaffolded fresh (not a wrapper of the old HTML file). Tailwind CSS v4 for utilities, plain CSS-variable tokens (OKLCH) in `src/styles/tokens.css` for the design system, mirroring the existing base exactly. A one-time Node migration script (`scripts/migrate-data.mjs`) reads the 160-topic raw JSON, extracts embedded base64 images to files, splits heavy `content_html` into per-topic files, and emits clean metadata + a normalized Hebrew search index. The script shares its Hebrew-normalization logic with the future runtime search module by importing a single TypeScript source file directly — Node 24 executes `.ts` natively via built-in type-stripping, confirmed working in this environment.

**Tech Stack:** Vite 6, React 18, TypeScript 5 (strict), Tailwind CSS v4 (`@tailwindcss/vite`), Vitest (unit tests), ESLint 9 (flat config) + Prettier, Node 24 built-in TS execution for the migration script.

## Global Constraints

- **Content is sacred**: never alter topic text/definitions/formulas during migration — only extract images and split HTML, byte-for-byte text preserved. (source: `site-build-docs/CLAUDE.md` rule 1, `02-DATA-MODEL-AND-MIGRATION.md`)
- **`topic.id` is the only key** for all future user data — must pass through migration unchanged. (rule 2)
- **Local-first**: no networking in this phase; nothing here may block on or require a network call. (rule 3)
- **User data → IndexedDB only**; `localStorage` reserved for small preferences (not touched in this plan). (rule 4)
- **RTL + both themes** must work on any new screen — the blank scaffold page must render `dir="rtl"` `lang="he"` and respond to `data-theme`. (rule 5)
- **Accessibility is required**, not optional, for every new interactive element (none yet in this phase, but `:focus-visible` token must exist from the start). (rule 6)
- **Colors via `--kb-*` tokens**, never hard-coded values in components. (rule 7)
- **Secrets never in git**: `.env` only, `.env.example` with placeholders (not needed until Phase 5/Supabase, so out of scope here). (rule 8)
- **Migration script must be idempotent**: re-running produces identical output (stable hash per identical image). (`02-DATA-MODEL-AND-MIGRATION.md` "כללי זהב")
- **Definition of done** for this plan: `npm run build` green, `npm run typecheck` clean, `npm run lint` clean, `npm run test` green, blank page renders in light+dark and RTL, migration produces `topics.clean.json` + `search-index.json` + extracted assets with a validation report showing 0 broken `related_match` links and 0 missing files.

---

## File Structure

```
Website AI  Engineer/                      (git repo root)
├─ .gitignore
├─ site-build-docs/                        (existing spec, untouched)
└─ kb-app/                                  (new Vite app — everything below is new)
   ├─ package.json
   ├─ tsconfig.json / tsconfig.app.json / tsconfig.node.json  (from Vite scaffold)
   ├─ vite.config.ts
   ├─ eslint.config.js
   ├─ .prettierrc.json
   ├─ index.html
   ├─ data/
   │  ├─ topics.raw.json                    (copied from site-build-docs/data — migration input)
   │  └─ modules.json                       (copied from site-build-docs/data)
   ├─ scripts/
   │  ├─ migrate-helpers.ts                  (pure, testable functions)
   │  ├─ migrate-helpers.test.ts
   │  └─ migrate-data.mjs                    (orchestration: fs I/O, calls migrate-helpers.ts)
   ├─ src/
   │  ├─ main.tsx
   │  ├─ App.tsx
   │  ├─ lib/
   │  │  ├─ normalize.ts                     (shared Hebrew text normalization)
   │  │  └─ normalize.test.ts
   │  ├─ data/                               (migration output lands here)
   │  │  ├─ topics.clean.json
   │  │  ├─ modules.json
   │  │  └─ search-index.json
   │  └─ styles/
   │     ├─ tokens.css                       (OKLCH design tokens, light+dark)
   │     └─ index.css                        (Tailwind import + global rules)
   └─ public/
      ├─ topic-assets/                       (migration output: extracted images)
      └─ topic-content/                      (migration output: per-topic HTML)
```

**Responsibility notes:**
- `scripts/migrate-helpers.ts` holds every pure function (no disk I/O): image extraction from HTML, safe id hashing, clean-metadata mapping. This is what gets unit tested.
- `scripts/migrate-data.mjs` is intentionally thin glue: reads raw JSON, calls helpers, writes files, prints the validation report. Not unit tested — verified by running it against the real 160-topic dataset and inspecting the report.
- `src/lib/normalize.ts` is imported by **both** the migration script and (in a later phase) the runtime search module — one implementation, per the spec's own requirement that migration and runtime search use identical normalization.

---

### Task 1: Initialize git repository

**Files:**
- Create: `Website AI  Engineer/.gitignore`

**Interfaces:** none (infra only).

- [ ] **Step 1: Initialize the repo**

Run in `Website AI  Engineer/`:
```bash
git init
```
Expected: `Initialized empty Git repository in .../Website AI  Engineer/.git/`

- [ ] **Step 2: Create root `.gitignore`**

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

- [ ] **Step 3: First commit (docs baseline)**

```bash
git add site-build-docs .gitignore
git commit -m "docs: add site-build-docs spec"
```
Expected: commit succeeds, `git log --oneline` shows one commit.

---

### Task 2: Scaffold the Vite React + TypeScript project

**Files:**
- Create: `kb-app/` (entire Vite scaffold output)

**Interfaces:** none yet — this is the base every later task builds on.

- [ ] **Step 1: Scaffold with Vite's react-ts template**

Run in `Website AI  Engineer/`:
```bash
npm create vite@latest kb-app -- --template react-ts
```
Expected: `kb-app/` created with `package.json`, `src/App.tsx`, `src/main.tsx`, `index.html`, `vite.config.ts`, `tsconfig*.json`.

- [ ] **Step 2: Install base dependencies**

```bash
cd kb-app
npm install
```
Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Verify the default scaffold builds**

```bash
npm run build
```
Expected: `dist/` produced, exit code 0.

- [ ] **Step 4: Commit the raw scaffold**

```bash
cd ..
git add kb-app
git commit -m "chore: scaffold kb-app with Vite + React + TypeScript"
```

---

### Task 3: Design tokens, RTL shell, theme wiring

**Files:**
- Create: `kb-app/src/styles/tokens.css`
- Create: `kb-app/src/styles/index.css`
- Modify: `kb-app/index.html`
- Modify: `kb-app/src/main.tsx`
- Modify: `kb-app/src/App.tsx`
- Delete: `kb-app/src/App.css`, `kb-app/src/index.css` (Vite scaffold defaults, replaced)

**Interfaces:**
- Produces: CSS custom properties `--kb-bg`, `--kb-surface`, `--kb-surface2`, `--kb-border`, `--kb-border-strong`, `--kb-text`, `--kb-text2`, `--kb-muted`, `--kb-accent`, `--kb-accent-soft`, `--kb-shadow-sm/md/lg`, `--kb-focus-ring`, `--kb-ease` — every later component styles against these, never hard-coded colors.

- [ ] **Step 1: Write `tokens.css`** (verbatim from `03-FRONTEND-SPEC.md` — do not alter values)

```css
:root {
  --kb-bg: oklch(97.5% 0.005 260);      --kb-surface: oklch(99.2% 0.003 260);
  --kb-surface2: oklch(95.5% 0.007 260); --kb-border: oklch(90% 0.01 260);
  --kb-border-strong: oklch(83% 0.014 260);
  --kb-text: oklch(23% 0.02 260); --kb-text2: oklch(38% 0.018 260); --kb-muted: oklch(52% 0.016 260);
  --kb-accent: oklch(54% 0.16 260); --kb-accent-soft: oklch(94% 0.03 260);

  --kb-shadow-sm: 0 1px 2px oklch(20% 0.02 260 / 0.06), 0 1px 3px oklch(20% 0.02 260 / 0.08);
  --kb-shadow-md: 0 4px 12px oklch(20% 0.02 260 / 0.10);
  --kb-shadow-lg: 0 12px 32px oklch(20% 0.02 260 / 0.14);
  --kb-focus-ring: 0 0 0 2px var(--kb-bg), 0 0 0 4px var(--kb-accent);
  --kb-ease: cubic-bezier(.2,.6,.2,1);
}
:root[data-theme="dark"] {
  --kb-bg: oklch(19% 0.012 260); --kb-surface: oklch(23% 0.014 260);
  --kb-surface2: oklch(27% 0.016 260); --kb-border: oklch(32% 0.016 260);
  --kb-border-strong: oklch(40% 0.018 260);
  --kb-text: oklch(93% 0.006 260); --kb-text2: oklch(80% 0.01 260); --kb-muted: oklch(64% 0.014 260);
  --kb-accent: oklch(74% 0.14 260); --kb-accent-soft: oklch(32% 0.06 260);

  --kb-shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.4);
  --kb-shadow-md: 0 4px 14px oklch(0% 0 0 / 0.45);
  --kb-shadow-lg: 0 14px 36px oklch(0% 0 0 / 0.55);
}
```

- [ ] **Step 2: Write `index.css`** (Tailwind import + global base rules; Tailwind package added in Task 4, this import is a forward reference)

```css
@import "tailwindcss";
@import "./tokens.css";

* {
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
}

body {
  margin: 0;
  background: var(--kb-bg);
  color: var(--kb-text);
  font-family: 'Heebo', system-ui, sans-serif;
  line-height: 1.6;
}

:focus-visible {
  box-shadow: var(--kb-focus-ring);
  outline: none;
}

a, button, [role="button"], input, select, textarea, [tabindex] {
  transition: background-color 160ms var(--kb-ease), color 160ms var(--kb-ease), box-shadow 160ms var(--kb-ease), transform 160ms var(--kb-ease);
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

- [ ] **Step 3: Update `index.html`** for RTL + Hebrew lang + theme color meta

```html
<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0f1220" />
    <title>מסד ידע — AI Engineer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Delete the scaffold's default stylesheets**

```bash
cd kb-app
rm src/App.css src/index.css
```

- [ ] **Step 5: Rewrite `src/main.tsx`** to import the new stylesheet

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Rewrite `src/App.tsx`** as a minimal placeholder that proves tokens + theme wiring work

```tsx
export default function App() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1 style={{ color: 'var(--kb-text)' }}>מסד ידע — AI Engineer</h1>
      <p style={{ color: 'var(--kb-muted)' }}>הבנייה החלה.</p>
    </main>
  );
}
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```
Expected: exit code 0, no TypeScript errors (Tailwind not installed yet, so this will fail on the `@import "tailwindcss"` — that's expected; proceed to Task 4 before verifying. Skip this step's verification until Task 4 Step 4.)

- [ ] **Step 8: Commit**

```bash
cd ..
git add kb-app
git commit -m "feat: RTL shell, OKLCH design tokens, theme wiring"
```

---

### Task 4: Configure Tailwind CSS v4

**Files:**
- Modify: `kb-app/vite.config.ts`
- Modify: `kb-app/package.json` (via npm install)

**Interfaces:**
- Consumes: `src/styles/index.css` from Task 3 (already has `@import "tailwindcss";`).
- Produces: Tailwind utility classes available in all components from this point on.

- [ ] **Step 1: Install Tailwind v4 and its Vite plugin**

```bash
cd kb-app
npm install tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Register the plugin in `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

- [ ] **Step 3: Verify dev server serves Tailwind + tokens correctly**

```bash
npm run dev -- --port 5173 &
sleep 2
curl -s http://localhost:5173/ | grep -o '<title>[^<]*</title>'
kill %1
```
Expected: prints `<title>מסד ידע — AI Engineer</title>` (confirms server responds; visual/theme check happens in Step 5).

- [ ] **Step 4: Verify production build is green**

```bash
npm run build
```
Expected: exit code 0, `dist/index.html` and hashed CSS/JS assets produced, no errors about `@import "tailwindcss"`.

- [ ] **Step 5: Manual check — light/dark/RTL**

```bash
npm run preview -- --port 4173 &
```
Open `http://localhost:4173/` in a browser. Confirm: page text is right-to-left, background is the light `--kb-bg` tone. Then in devtools console run `document.documentElement.setAttribute('data-theme','dark')` and confirm background/text swap to the dark tokens. Stop the preview server (`kill %1` or Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "feat: configure Tailwind CSS v4"
```

---

### Task 5: ESLint + Prettier

**Files:**
- Create: `kb-app/eslint.config.js`
- Create: `kb-app/.prettierrc.json`
- Modify: `kb-app/package.json` (scripts + devDependencies)

**Interfaces:** none (tooling only).

- [ ] **Step 1: Install ESLint, TypeScript-ESLint, React hooks/refresh plugins, Prettier**

```bash
cd kb-app
npm install -D eslint @eslint/js typescript-eslint globals eslint-plugin-react-hooks eslint-plugin-react-refresh prettier eslint-config-prettier
```

- [ ] **Step 2: Write `eslint.config.js`**

```js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'public/topic-assets', 'public/topic-content'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  prettierConfig,
);
```

- [ ] **Step 3: Write `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 4: Add `lint` and `format` scripts to `package.json`**

```json
{
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

- [ ] **Step 5: Run lint, confirm clean**

```bash
npm run lint
```
Expected: exit code 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js .prettierrc.json package.json package-lock.json
git commit -m "chore: configure ESLint + Prettier"
```

---

### Task 6: Vitest setup

**Files:**
- Modify: `kb-app/package.json` (scripts + devDependencies)
- Create: `kb-app/vitest.config.ts`

**Interfaces:**
- Produces: `npm test` command that later tasks' unit tests run under.

- [ ] **Step 1: Install Vitest**

```bash
cd kb-app
npm install -D vitest
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add `test` script**

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

- [ ] **Step 4: Verify it runs with zero tests**

```bash
npm test
```
Expected: exit code 0, "No test files found" or similar (no test files exist yet — that's fine, confirms the runner itself works).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: configure Vitest"
```

---

### Task 7: Bring in the raw content data

**Files:**
- Create: `kb-app/data/topics.raw.json` (copy)
- Create: `kb-app/data/modules.json` (copy)

**Interfaces:**
- Produces: the on-disk input the migration script (Task 9–11) reads.

- [ ] **Step 1: Copy the source data into the app**

```bash
cd "Website AI  Engineer"
cp site-build-docs/data/topics.raw.json kb-app/data/topics.raw.json
cp site-build-docs/data/modules.json kb-app/data/modules.json
```

- [ ] **Step 2: Verify counts match the spec**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('kb-app/data/topics.raw.json')).length)"
```
Expected: `160`.

- [ ] **Step 3: Commit**

```bash
git add kb-app/data
git commit -m "data: import raw 160-topic dataset for migration"
```

---

### Task 8: Shared Hebrew normalization (`src/lib/normalize.ts`)

**Files:**
- Create: `kb-app/src/lib/normalize.ts`
- Test: `kb-app/src/lib/normalize.test.ts`

**Interfaces:**
- Produces: `normalize(s: string): string` — used by the migration script (Task 11) to build `search-index.json`, and later (Phase 2) by the runtime search module. This is the single canonical implementation; do not duplicate this logic anywhere else.

- [ ] **Step 1: Write the failing test**

```ts
// kb-app/src/lib/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { normalize } from './normalize';

describe('normalize', () => {
  it('lowercases and trims', () => {
    expect(normalize('  HeLLo  ')).toBe('hello');
  });

  it('strips Hebrew niqqud (vowel points)', () => {
    expect(normalize('רְגרֶסיה')).toBe('רגרסיה');
  });

  it('strips geresh/gershayim quote marks', () => {
    expect(normalize(`ה"אלגוריתם" של ק'מינס`)).toBe('האלגוריתם של קמינס');
  });

  it('turns hyphens/dashes/underscores into spaces', () => {
    expect(normalize('K-Means_Clustering')).toBe('k means clustering');
  });

  it('collapses repeated whitespace', () => {
    expect(normalize('a   b\t\nc')).toBe('a b c');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd kb-app
npx vitest run src/lib/normalize.test.ts
```
Expected: FAIL — `Cannot find module './normalize'`.

- [ ] **Step 3: Implement `normalize.ts`** (verbatim algorithm from `02-DATA-MODEL-AND-MIGRATION.md`)

```ts
// kb-app/src/lib/normalize.ts
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '') // Hebrew niqqud + cantillation marks
    .replace(/["'`׳״]/g, '') // geresh/gershayim/quotes
    .replace(/[-–—_]/g, ' ') // hyphens/dashes/underscore -> space
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/normalize.test.ts
```
Expected: PASS, 5 tests passed.

- [ ] **Step 5: Commit**

```bash
cd ..
git add kb-app/src/lib/normalize.ts kb-app/src/lib/normalize.test.ts
git commit -m "feat: shared Hebrew text normalization for search"
```

---

### Task 9: Migration helper — safe id hashing + base64 image extraction

**Files:**
- Create: `kb-app/scripts/migrate-helpers.ts`
- Test: `kb-app/scripts/migrate-helpers.test.ts`

**Interfaces:**
- Consumes: `node:crypto` (`createHash`) — Node built-in, no install needed.
- Produces: `hashId(id: string): string` and `extractBase64Images(html: string): { html: string; images: ExtractedImage[] }` where `ExtractedImage = { hash: string; ext: string; buffer: Buffer }`. Task 10 and Task 11 depend on these exact names/shapes.

- [ ] **Step 1: Write the failing tests**

```ts
// kb-app/scripts/migrate-helpers.test.ts
import { describe, it, expect } from 'vitest';
import { hashId, extractBase64Images } from './migrate-helpers';

describe('hashId', () => {
  it('is stable for the same input', () => {
    expect(hashId('abc')).toBe(hashId('abc'));
  });

  it('produces a 12-char lowercase hex string', () => {
    expect(hashId('abc')).toMatch(/^[a-f0-9]{12}$/);
  });

  it('differs for different input', () => {
    expect(hashId('abc')).not.toBe(hashId('abd'));
  });
});

describe('extractBase64Images', () => {
  it('leaves plain HTML untouched and returns no images', () => {
    const html = '<p>hello</p>';
    const result = extractBase64Images(html);
    expect(result.html).toBe(html);
    expect(result.images).toHaveLength(0);
  });

  it('replaces a base64 image src with a /topic-assets/<hash>.<ext> path', () => {
    const tinyPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const html = `<img src="data:image/png;base64,${tinyPngBase64}">`;
    const result = extractBase64Images(html);
    expect(result.images).toHaveLength(1);
    const [img] = result.images;
    expect(img.ext).toBe('png');
    expect(result.html).toBe(`<img src="/topic-assets/${img.hash}.png" loading="lazy">`);
  });

  it('produces the same hash for identical image data (idempotent)', () => {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const html = `<img src="data:image/png;base64,${b64}"><img src="data:image/png;base64,${b64}">`;
    const result = extractBase64Images(html);
    expect(result.images).toHaveLength(2);
    expect(result.images[0].hash).toBe(result.images[1].hash);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd kb-app
npx vitest run scripts/migrate-helpers.test.ts
```
Expected: FAIL — `Cannot find module './migrate-helpers'`.

- [ ] **Step 3: Implement `migrate-helpers.ts`**

```ts
// kb-app/scripts/migrate-helpers.ts
import { createHash } from 'node:crypto';

export function hashId(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12);
}

export interface ExtractedImage {
  hash: string;
  ext: string;
  buffer: Buffer;
}

export interface ExtractResult {
  html: string;
  images: ExtractedImage[];
}

const DATA_URI_RE = /src="data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)"/g;

export function extractBase64Images(html: string): ExtractResult {
  const images: ExtractedImage[] = [];

  const outHtml = html.replace(DATA_URI_RE, (_match, mime: string, b64: string) => {
    const ext = mime === 'jpeg' ? 'jpg' : mime;
    const buffer = Buffer.from(b64, 'base64');
    const hash = hashId(b64);
    images.push({ hash, ext, buffer });
    return `src="/topic-assets/${hash}.${ext}" loading="lazy"`;
  });

  return { html: outHtml, images };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run scripts/migrate-helpers.test.ts
```
Expected: PASS, 6 tests passed.

- [ ] **Step 5: Commit**

```bash
cd ..
git add kb-app/scripts/migrate-helpers.ts kb-app/scripts/migrate-helpers.test.ts
git commit -m "feat: migration helpers — stable id hashing + base64 image extraction"
```

---

### Task 10: Migration helper — clean metadata mapping

**Files:**
- Modify: `kb-app/scripts/migrate-helpers.ts`
- Modify: `kb-app/scripts/migrate-helpers.test.ts`

**Interfaces:**
- Consumes: `hashId` from Task 9.
- Produces: `RawTopic` type and `buildCleanTopicMeta(raw: RawTopic, contentPath: string): CleanTopicMeta`. Task 11 depends on this exact function name, and on `CleanTopicMeta` having exactly the fields listed in `02-DATA-MODEL-AND-MIGRATION.md`: `id, module, module_label, category, category_label, num, slug_name, title, definition, related_raw, related_match, contentPath`.

- [ ] **Step 1: Write the failing test**

```ts
// append to kb-app/scripts/migrate-helpers.test.ts
import { buildCleanTopicMeta, type RawTopic } from './migrate-helpers';

describe('buildCleanTopicMeta', () => {
  const raw: RawTopic = {
    id: 'Intro to Data Science::algorithms::02_Linear_Regression.docx',
    module: 'Intro to Data Science',
    module_label: 'מבוא למדעי הנתונים',
    category: 'algorithms',
    category_icon: '⚙️',
    category_label: 'אלגוריתמים',
    num: 2,
    filename: '02_Linear_Regression.docx',
    slug_name: 'Linear Regression',
    title: 'Linear Regression — רגרסיה לינארית',
    definition: 'שיטת למידה מונחית לחיזוי ערך רציף.',
    content_html: '<p>should not appear in clean metadata</p>',
    related_raw: ['Foo'],
    related_match: [null],
    link: 'ignored-in-clean-output',
    _search: 'ignored-in-clean-output',
  };

  it('keeps only the documented clean fields, no content_html', () => {
    const clean = buildCleanTopicMeta(raw, '/topic-content/abc123.html');
    expect(clean).toEqual({
      id: raw.id,
      module: raw.module,
      module_label: raw.module_label,
      category: raw.category,
      category_label: raw.category_label,
      num: raw.num,
      slug_name: raw.slug_name,
      title: raw.title,
      definition: raw.definition,
      related_raw: raw.related_raw,
      related_match: raw.related_match,
      contentPath: '/topic-content/abc123.html',
    });
  });

  it('never alters id, title, or definition text', () => {
    const clean = buildCleanTopicMeta(raw, '/topic-content/abc123.html');
    expect(clean.id).toBe(raw.id);
    expect(clean.title).toBe(raw.title);
    expect(clean.definition).toBe(raw.definition);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd kb-app
npx vitest run scripts/migrate-helpers.test.ts
```
Expected: FAIL — `buildCleanTopicMeta` / `RawTopic` not exported.

- [ ] **Step 3: Add the type and function to `migrate-helpers.ts`**

```ts
// append to kb-app/scripts/migrate-helpers.ts
export interface RawTopic {
  id: string;
  module: string;
  module_label: string;
  category: string;
  category_icon: string;
  category_label: string;
  num: number;
  filename: string;
  slug_name: string;
  title: string;
  definition: string;
  content_html: string;
  related_raw: string[];
  related_match: (string | null)[];
  link: string;
  _search: string;
}

export interface CleanTopicMeta {
  id: string;
  module: string;
  module_label: string;
  category: string;
  category_label: string;
  num: number;
  slug_name: string;
  title: string;
  definition: string;
  related_raw: string[];
  related_match: (string | null)[];
  contentPath: string;
}

export function buildCleanTopicMeta(raw: RawTopic, contentPath: string): CleanTopicMeta {
  return {
    id: raw.id,
    module: raw.module,
    module_label: raw.module_label,
    category: raw.category,
    category_label: raw.category_label,
    num: raw.num,
    slug_name: raw.slug_name,
    title: raw.title,
    definition: raw.definition,
    related_raw: raw.related_raw,
    related_match: raw.related_match,
    contentPath,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run scripts/migrate-helpers.test.ts
```
Expected: PASS, 8 tests passed total.

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -30
```
Expected: no errors referencing `migrate-helpers.ts` (Task 12 wires up the final `typecheck` script; for now confirm no type errors surface).

- [ ] **Step 6: Commit**

```bash
cd ..
git add kb-app/scripts/migrate-helpers.ts kb-app/scripts/migrate-helpers.test.ts
git commit -m "feat: migration helper for clean topic metadata mapping"
```

---

### Task 11: Migration script orchestration + real run

**Files:**
- Create: `kb-app/scripts/migrate-data.mjs`
- Produces (generated, not hand-written): `kb-app/src/data/topics.clean.json`, `kb-app/src/data/modules.json`, `kb-app/src/data/search-index.json`, `kb-app/public/topic-assets/*`, `kb-app/public/topic-content/*.html`

**Interfaces:**
- Consumes: `hashId`, `extractBase64Images`, `buildCleanTopicMeta` from `scripts/migrate-helpers.ts` (Tasks 9–10); `normalize` from `src/lib/normalize.ts` (Task 8).
- Produces: `search-index.json` entries shaped `{ id: string, search: string }` where `search` = `normalize(title + ' ' + definition)`. This exact shape is what the future runtime search module (Phase 2) will consume — do not change it without updating that later plan too.

- [ ] **Step 1: Write `migrate-data.mjs`**

```js
// kb-app/scripts/migrate-data.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashId, extractBase64Images, buildCleanTopicMeta } from './migrate-helpers.ts';
import { normalize } from '../src/lib/normalize.ts';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const rawPath = join(root, 'data/topics.raw.json');
const modulesPath = join(root, 'data/modules.json');
const assetsDir = join(root, 'public/topic-assets');
const contentDir = join(root, 'public/topic-content');
const outDir = join(root, 'src/data');

mkdirSync(assetsDir, { recursive: true });
mkdirSync(contentDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const rawTopics = JSON.parse(readFileSync(rawPath, 'utf-8'));
const modules = JSON.parse(readFileSync(modulesPath, 'utf-8'));

const cleanTopics = [];
const searchIndex = [];
let imagesExtracted = 0;
let contentFilesWritten = 0;
const knownIds = new Set(rawTopics.map((t) => t.id));
const brokenLinks = [];

for (const raw of rawTopics) {
  const idHash = hashId(raw.id);
  const contentPath = `/topic-content/${idHash}.html`;

  const { html, images } = extractBase64Images(raw.content_html);
  for (const img of images) {
    const file = join(assetsDir, `${img.hash}.${img.ext}`);
    if (!existsSync(file)) {
      writeFileSync(file, img.buffer);
    }
    imagesExtracted += 1;
  }

  writeFileSync(join(contentDir, `${idHash}.html`), html, 'utf-8');
  contentFilesWritten += 1;

  cleanTopics.push(buildCleanTopicMeta(raw, contentPath));
  searchIndex.push({ id: raw.id, search: normalize(`${raw.title} ${raw.definition}`) });

  for (const target of raw.related_match) {
    if (target !== null && !knownIds.has(target)) {
      brokenLinks.push({ from: raw.id, to: target });
    }
  }
}

writeFileSync(join(outDir, 'topics.clean.json'), JSON.stringify(cleanTopics, null, 2));
writeFileSync(join(outDir, 'modules.json'), JSON.stringify(modules, null, 2));
writeFileSync(join(outDir, 'search-index.json'), JSON.stringify(searchIndex, null, 2));

console.log('--- Migration report ---');
console.log(`Topics processed:       ${rawTopics.length}`);
console.log(`Content files written:  ${contentFilesWritten}`);
console.log(`Images extracted:       ${imagesExtracted}`);
console.log(`Broken related_match:   ${brokenLinks.length}`);
if (brokenLinks.length > 0) {
  console.log(JSON.stringify(brokenLinks, null, 2));
}

if (brokenLinks.length > 0) {
  process.exitCode = 1;
}
```

- [ ] **Step 2: Add the `migrate` script to `package.json`**

```json
{
  "scripts": {
    "migrate": "node scripts/migrate-data.mjs"
  }
}
```

- [ ] **Step 3: Run the migration against the real 160-topic dataset**

```bash
cd kb-app
npm run migrate
```
Expected output ends with:
```
--- Migration report ---
Topics processed:       160
Content files written:  160
Images extracted:       351
Broken related_match:   0
```
(If `Broken related_match` is not 0, stop and investigate — do not proceed with broken data. If it differs from 0, that's real signal about the source data, not a bug to silently ignore.)

- [ ] **Step 4: Verify output files exist and are lightweight**

```bash
ls src/data/
du -h src/data/topics.clean.json src/data/search-index.json
du -sh public/topic-assets public/topic-content
```
Expected: `topics.clean.json` and `search-index.json` present, each well under 1MB combined (spec target: raw 7.9MB → ~1MB clean json + separate asset files).

- [ ] **Step 5: Verify idempotency — re-run and confirm identical output**

```bash
cp src/data/topics.clean.json /tmp/topics.clean.before.json
npm run migrate
diff /tmp/topics.clean.before.json src/data/topics.clean.json
```
Expected: `diff` produces no output (files identical).

- [ ] **Step 6: Sanity-spot-check one migrated topic in a browser**

```bash
npx serve public -l 4174 &
```
Open `http://localhost:4174/topic-content/<any-hash>.html` (pick a hash from `src/data/topics.clean.json`'s `contentPath` for a topic known to have had an embedded image, e.g. the K-Means topic) and confirm the `<img>` tag now points to `/topic-assets/<hash>.png` with `loading="lazy"`, and the referenced file exists under `public/topic-assets/`. Stop the server afterward.

- [ ] **Step 7: Commit generated data + script**

```bash
cd ..
git add kb-app/scripts/migrate-data.mjs kb-app/package.json kb-app/src/data kb-app/public/topic-assets kb-app/public/topic-content
git commit -m "feat: run data migration — clean topics, search index, extracted assets"
```

---

### Task 12: Final wiring — typecheck script, CLAUDE.md, full verification pass

**Files:**
- Modify: `kb-app/package.json` (add `typecheck` script)
- Create: `kb-app/CLAUDE.md` (copied from `site-build-docs/CLAUDE.md`)

**Interfaces:** none — this task closes out the plan's Definition of Done.

- [ ] **Step 1: Add `typecheck` script**

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json"
  }
}
```

- [ ] **Step 2: Copy `CLAUDE.md` to the app root**

```bash
cp "site-build-docs/CLAUDE.md" kb-app/CLAUDE.md
```

- [ ] **Step 3: Run the full verification suite**

```bash
cd kb-app
npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all four commands exit 0, in order.

- [ ] **Step 4: Manual RTL/theme/blank-page check** (repeat of Task 4 Step 5, now with real migrated data present but not yet rendered — confirms no regression)

```bash
npm run preview -- --port 4173 &
```
Open `http://localhost:4173/`, confirm RTL layout and light theme, toggle `data-theme="dark"` via devtools console, confirm dark tokens apply. Stop the server.

- [ ] **Step 5: Final commit**

```bash
cd ..
git add kb-app/package.json kb-app/CLAUDE.md
git commit -m "chore: add typecheck script and repo CLAUDE.md; Phase 0+1 complete"
```

- [ ] **Step 6: Confirm Definition of Done**

Checklist (from Global Constraints above) — all must be true:
- [ ] `npm run build` green
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run test` green
- [ ] Blank page renders correctly in light+dark, RTL
- [ ] Migration report: 160 topics processed, 0 broken `related_match`, images extracted and playable in browser
- [ ] Re-running `npm run migrate` produces byte-identical output (idempotent)

---

## What's next (not in this plan)

This plan covers **Phase 0 (infra) + Phase 1 (data migration)** only, per `00-BUILD-README.md`'s own phase breakdown — each remaining phase is a separable subsystem and gets its own plan when we get there:

- **Phase 2 — Frontend core**: header/hero/sidebar, search (consumes `normalize()` + `search-index.json` from this plan), multi-filter, accordion, sort, grid/list, topic reader, KaTeX, themes, P0 fixes (shadows/hover-lift, `focus-visible` everywhere, full keyboard nav).
- **Phase 3 — Local learning tools**: progress tracking, favorites/recents, notes, flashcards + SRS, quiz mode, command palette — all via IndexedDB (`src/lib/db.ts`).
- **Phase 4 — PWA + offline**: `vite-plugin-pwa`, manifest, icons, install prompt, caching strategy.
- **Phase 5 — Supabase backend + sync**: schema/RLS, auth, `src/lib/sync.ts` local-first sync.
- **Phase 6 — Deploy**: Cloudflare Pages, env vars, domain, CI.
