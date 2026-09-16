# kb-app Visual Identity Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warm up kb-app's visual identity — a display heading typeface, softer layered card shadows, a second "warm" accent color for due-today states, and tighter/looser per-screen layout density — on top of the shadcn/ui component layer that just merged to `master`.

**Architecture:** Token-and-className-only changes. No component architecture changes (shadcn/Radix primitives stay exactly as delivered), no new dependencies beyond one font package, no changes to `lib/theme.ts`'s dark-mode mechanism or the `--kb-*` token *shape* (only new/adjusted token values).

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4 (`--kb-*` OKLCH custom properties, no `tailwind.config.js`), `@fontsource/*` self-hosted fonts, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-16-visual-identity-refresh-design.md`

## Global Constraints

- App is RTL-only (`dir="rtl"`), Hebrew-first UI text — any new font must have a `hebrew` subset (verified for both fonts used here: Heebo, Rubik).
- Dark mode is attribute-based (`data-theme="dark"`) — every new/changed token gets both a `:root` (light) and `:root[data-theme="dark"]` value.
- `--kb-*` custom properties are the single source of truth for color; never hardcode a literal color in a component.
- `.kb-topic-content` CSS and the raw topic-article HTML it styles must never be touched.
- No `tailwind.config.js` — Tailwind v4, all config lives in `kb-app/src/styles/tokens.css` / `index.css`.
- Definition of done, per task: `npm run typecheck && npm run lint && npm run test && npm run build` green in `kb-app/`.
- **This pass is fonts/color/spacing, not component behavior — automated tests verify structure (right class present, right token referenced), not appearance.** Task 5's manual browser pass is the actual verification for this plan, not optional follow-up.
- All commands below run with `kb-app/` as the working directory unless stated otherwise.

---

## Task 1: Typography — Rubik display headings over Heebo body

**Files:**
- Modify: `kb-app/package.json` (add `@fontsource/rubik`)
- Modify: `kb-app/src/main.tsx` (import Rubik weights)
- Modify: `kb-app/src/styles/tokens.css` (add `--kb-font-heading`)
- Modify: `kb-app/src/pages/Flashcards.tsx` (2 headings)
- Modify: `kb-app/src/pages/Map.tsx` (1 heading)
- Modify: `kb-app/src/pages/Quiz.tsx` (2 headings)
- Modify: `kb-app/src/pages/Settings.tsx` (6 headings)
- Modify: `kb-app/src/pages/NotFound.tsx` (1 heading)
- Modify: `kb-app/src/components/browse/TopicCard.tsx` (1 heading)
- Modify: `kb-app/src/components/reader/RelatedTopics.tsx` (1 heading)
- Test: `kb-app/src/components/browse/TopicCard.test.tsx`
- Test: `kb-app/src/pages/Flashcards.test.tsx`
- Test: `kb-app/src/pages/Settings.test.tsx`

**Interfaces:**
- Produces: `--kb-font-heading` custom property (`kb-app/src/styles/tokens.css`), referenced via Tailwind arbitrary-value syntax `font-[var(--kb-font-heading)]` — the same pattern this codebase already uses for colors (`text-[var(--kb-text)]`).

- [ ] **Step 1: Add the `@fontsource/rubik` dependency**

```bash
npm install @fontsource/rubik
```

- [ ] **Step 2: Import Rubik's heading weights**

In `kb-app/src/main.tsx`, add after the existing Heebo imports (after the line importing `@fontsource/heebo/800.css`):

```ts
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';
```

- [ ] **Step 3: Add the heading font token**

In `kb-app/src/styles/tokens.css`, inside the `:root { ... }` block (the same block that declares `--kb-font-sans`), add immediately after the `--kb-font-sans` line:

```css
  --kb-font-heading: 'Rubik', var(--kb-font-sans);
```

This is theme-independent (no dark-mode override needed — it's a font stack, not a color).

- [ ] **Step 4: Apply the heading font to display titles and section headings**

Replace each `className` below exactly (old → new). Every other attribute on these elements is unchanged — only the `className` string changes, by appending `font-[var(--kb-font-heading)]` to the existing classes.

| File:line | Old `className` | New `className` |
|---|---|---|
| `kb-app/src/pages/Flashcards.tsx:181` | `"mb-4 text-xl font-bold text-[var(--kb-text)]"` | `"mb-4 text-xl font-bold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/pages/Flashcards.tsx:252` | `"mb-4 text-xl font-bold text-[var(--kb-text)]"` | `"mb-4 text-xl font-bold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/pages/Map.tsx:107` | `"mb-4 text-xl font-bold text-[var(--kb-text)]"` | `"mb-4 text-xl font-bold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/pages/Quiz.tsx:133` | `"mb-4 text-xl font-bold text-[var(--kb-text)]"` | `"mb-4 text-xl font-bold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/pages/Quiz.tsx:192` | `"mb-4 text-xl font-bold text-[var(--kb-text)]"` | `"mb-4 text-xl font-bold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/pages/Settings.tsx:197` | `"text-xl font-bold text-[var(--kb-text)]"` | `"text-xl font-bold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/pages/Settings.tsx:209` | `"font-semibold text-[var(--kb-text)]"` | `"font-semibold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/pages/Settings.tsx:233` | `"font-semibold text-[var(--kb-text)]"` | `"font-semibold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/pages/Settings.tsx:274` | `"font-semibold text-[var(--kb-text)]"` | `"font-semibold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/pages/Settings.tsx:291` | `"font-semibold text-[var(--kb-text)]"` | `"font-semibold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/pages/Settings.tsx:301` | `"font-semibold text-[var(--kb-text)]"` | `"font-semibold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/pages/NotFound.tsx:12` | `"text-2xl font-extrabold text-[var(--kb-text)]"` | `"text-2xl font-extrabold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/components/browse/TopicCard.tsx:41` | `"text-base font-bold text-[var(--kb-text)]"` | `"text-base font-bold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |
| `kb-app/src/components/reader/RelatedTopics.tsx:24` | `"mb-3 text-base font-bold text-[var(--kb-text)]"` | `"mb-3 text-base font-bold font-[var(--kb-font-heading)] text-[var(--kb-text)]"` |

Line numbers are from the current `master` (`f49484f`) — if a file has drifted, find the heading by its Hebrew text (given in each grep result above) rather than trusting the line number blindly.

**Explicitly do NOT touch** (small `text-xs`/`text-sm` navigational/section-label headings — stay Heebo, per the spec's rationale that mixing typefaces at small sizes reads as noise, not warmth): `Home.tsx`'s `sr-only` `<h1>`, `Sidebar.tsx`'s `<h2>`, `ReaderAside.tsx`'s two `<h2>`s, `TableOfContents.tsx`'s `<h2>`, `Quiz.tsx:204`'s `<h2>` (`text-sm`).

- [ ] **Step 5: Add a regression test for the pattern on `TopicCard`**

In `kb-app/src/components/browse/TopicCard.test.tsx`, add inside the existing `describe('TopicCard', ...)` block:

```tsx
  it('uses the heading font on the title', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveClass('font-[var(--kb-font-heading)]');
  });
```

- [ ] **Step 6: Add a regression test on a page-level `<h1>`**

In `kb-app/src/pages/Flashcards.test.tsx`, add inside `describe('Flashcards', ...)` (this file's existing render helper is `renderPage()`, taking no arguments):

```tsx
  it('uses the heading font on the page title', () => {
    renderPage();
    const heading = screen.getByRole('heading', { level: 1, name: 'כרטיסיות' });
    expect(heading).toHaveClass('font-[var(--kb-font-heading)]');
  });
```

- [ ] **Step 7: Add a regression test on a Settings section heading**

In `kb-app/src/pages/Settings.test.tsx`, add inside its `describe` block (this file's existing render helper is `renderSettings()`, taking no arguments):

```tsx
  it('uses the heading font on section headings', () => {
    renderSettings();
    const heading = screen.getByRole('heading', { level: 2, name: 'מראה' });
    expect(heading).toHaveClass('font-[var(--kb-font-heading)]');
  });
```

- [ ] **Step 8: Run the affected tests**

Run: `npx vitest run src/components/browse/TopicCard.test.tsx src/pages/Flashcards.test.tsx src/pages/Settings.test.tsx src/pages/Map.test.tsx src/pages/Quiz.test.tsx src/components/reader/RelatedTopics.test.tsx`
Expected: all pass — the new tests pass, and no existing test in these files (which query by role/text, not full className strings) breaks from the added class. (`NotFound.tsx` has no test file today — nothing to run there; Step 4's edit to it still applies.)

- [ ] **Step 9: Full verification and commit**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all green.

```bash
git add package.json package-lock.json src/main.tsx src/styles/tokens.css \
  src/pages/Flashcards.tsx src/pages/Flashcards.test.tsx \
  src/pages/Map.tsx src/pages/Quiz.tsx src/pages/Settings.tsx src/pages/Settings.test.tsx \
  src/pages/NotFound.tsx src/components/browse/TopicCard.tsx \
  src/components/browse/TopicCard.test.tsx src/components/reader/RelatedTopics.tsx
git commit -m "feat: add Rubik display-heading typeface over Heebo body text"
```

---

## Task 2: Depth — layered card shadow

**Files:**
- Modify: `kb-app/src/styles/tokens.css` (add `--kb-shadow-card`, light + dark)
- Modify: `kb-app/src/components/browse/TopicCard.tsx`
- Modify: `kb-app/src/components/browse/TopicListRow.tsx`
- Modify: `kb-app/src/components/home/DashboardCard.tsx`
- Test: `kb-app/src/components/browse/TopicCard.test.tsx`
- Test: `kb-app/src/components/home/DashboardCard.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `--kb-shadow-card` custom property, used by any future `Card`-wrapped surface that wants the "lifted" treatment (not just the three consumers in this task).

- [ ] **Step 1: Add the shadow token**

In `kb-app/src/styles/tokens.css`, inside `:root { ... }` (near the existing `--kb-shadow-sm`/`--kb-shadow-md`/`--kb-shadow-lg` lines), add:

```css
  --kb-shadow-card: 0 1px 2px oklch(20% 0.02 260 / 0.04), 0 8px 20px oklch(20% 0.02 260 / 0.07);
```

Inside `:root[data-theme="dark"] { ... }` (near the existing dark `--kb-shadow-*` overrides), add:

```css
  --kb-shadow-card: 0 1px 2px oklch(0% 0 0 / 0.3), 0 8px 24px oklch(0% 0 0 / 0.35);
```

- [ ] **Step 2: Apply it to `TopicCard`**

In `kb-app/src/components/browse/TopicCard.tsx`, the `<Card className="...">` currently reads (find by the `kb-topic-card` class):

```tsx
    <Card className="kb-topic-card relative flex flex-col gap-2 p-4 transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]">
```

Change to:

```tsx
    <Card className="kb-topic-card relative flex flex-col gap-2 p-4 shadow-[var(--kb-shadow-card)] transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]">
```

(This overrides the shadcn `Card` primitive's default `shadow-sm` via Tailwind's merge behavior — `card.tsx`'s base class and this arbitrary-value class are in the same `shadow` merge group, the same mechanism already verified working for `min-w-0`/`p-0` overriding `toggleVariants`' defaults on `TopicFavoriteButton` in the shadcn migration's final review.)

- [ ] **Step 3: Apply it to `TopicListRow`**

In `kb-app/src/components/browse/TopicListRow.tsx`, the `<Card className="...">` currently reads (find by the `kb-topic-list-row` class):

```tsx
    <Card className="kb-topic-list-row relative flex min-h-16 items-center gap-3 px-3 py-2.5 transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]">
```

Change to:

```tsx
    <Card className="kb-topic-list-row relative flex min-h-16 items-center gap-3 px-3 py-2.5 shadow-[var(--kb-shadow-card)] transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]">
```

- [ ] **Step 4: Apply it to `DashboardCard`'s shared tile class**

In `kb-app/src/components/home/DashboardCard.tsx`, the `tileClass` constant currently reads:

```tsx
const tileClass =
  'flex flex-col gap-3 rounded-2xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-4 shadow-[var(--kb-shadow-sm)]';
```

Change to:

```tsx
const tileClass =
  'flex flex-col gap-3 rounded-2xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-4 shadow-[var(--kb-shadow-card)]';
```

This changes all three dashboard tiles (progress, spaced-review, continue-reading) at once, since they all reference the same `tileClass` constant.

- [ ] **Step 5: Add regression tests**

In `kb-app/src/components/browse/TopicCard.test.tsx`, add inside `describe('TopicCard', ...)`:

```tsx
  it('uses the layered card shadow', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />);
    const card = screen.getByRole('link').closest('.kb-topic-card');
    expect(card).toHaveClass('shadow-[var(--kb-shadow-card)]');
  });
```

In `kb-app/src/components/home/DashboardCard.test.tsx`, add inside its `describe` block (using this file's existing `renderCard()` helper):

```tsx
  it('uses the layered card shadow on the dashboard tiles', () => {
    const { container } = renderCard();
    const tiles = Array.from(container.querySelectorAll('div')).filter((el) =>
      el.className.includes('shadow-[var(--kb-shadow-card)]'),
    );
    expect(tiles).toHaveLength(3);
  });
```

- [ ] **Step 6: Run the affected tests**

Run: `npx vitest run src/components/browse/TopicCard.test.tsx src/components/home/DashboardCard.test.tsx`
Expected: all pass.

- [ ] **Step 7: Full verification and commit**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all green.

```bash
git add src/styles/tokens.css src/components/browse/TopicCard.tsx \
  src/components/browse/TopicCard.test.tsx src/components/browse/TopicListRow.tsx \
  src/components/home/DashboardCard.tsx src/components/home/DashboardCard.test.tsx
git commit -m "feat: layered card shadow for a lifted, less flat card surface"
```

---

## Task 3: A second, warm accent for due-today states

**Files:**
- Modify: `kb-app/src/styles/tokens.css` (add `--kb-accent-warm`, `--kb-on-accent-warm`, light + dark)
- Modify: `kb-app/src/components/home/DashboardCard.tsx`
- Test: `kb-app/src/components/home/DashboardCard.test.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: `--kb-accent-warm` / `--kb-on-accent-warm` custom properties, for any future celebratory/urgent-nudge UI (this task wires up the one concrete consumer that exists today: the spaced-review tile's due-count headline).

- [ ] **Step 1: Add the warm accent tokens**

In `kb-app/src/styles/tokens.css`, inside `:root { ... }`, add (near the existing `--kb-accent`/`--kb-accent-soft` lines):

```css
  --kb-accent-warm: oklch(78% 0.11 95);
  --kb-on-accent-warm: oklch(25% 0.02 95);
```

Inside `:root[data-theme="dark"] { ... }`, add:

```css
  --kb-accent-warm: oklch(80% 0.10 95);
  --kb-on-accent-warm: oklch(20% 0.02 95);
```

**These are starting values, not final ones — Task 5's manual pass verifies they read as visually distinct from `--kb-cat-metrics` (hue 75) in both themes, and adjusts the hue/chroma here if not.**

- [ ] **Step 2: Apply it to the due-today headline**

In `kb-app/src/components/home/DashboardCard.tsx`, the spaced-review tile currently reads:

```tsx
      <Card className={tileClass}>
        <span className="text-xs font-medium text-[var(--kb-muted)]">חזרה מרווחת</span>
        <span className="text-base font-bold text-[var(--kb-text)]">{review.headline}</span>
        <span className="text-xs text-[var(--kb-muted)]">{`נסקרו עד כה ${reviewedCount} כרטיסים`}</span>
```

Change the headline `<span>` so it uses the warm accent specifically when there are cards due today (not for the "no reviews scheduled" fallback copy, which isn't a due-today nudge):

```tsx
      <Card className={tileClass}>
        <span className="text-xs font-medium text-[var(--kb-muted)]">חזרה מרווחת</span>
        <span
          className={`text-base font-bold ${dueCount > 0 ? 'text-[var(--kb-accent-warm)]' : 'text-[var(--kb-text)]'}`}
        >
          {review.headline}
        </span>
        <span className="text-xs text-[var(--kb-muted)]">{`נסקרו עד כה ${reviewedCount} כרטיסים`}</span>
```

`dueCount` is already a prop this component receives (used earlier by `reviewCopy(dueCount, newCount)`) — no new prop threading needed.

- [ ] **Step 3: Add regression tests**

In `kb-app/src/components/home/DashboardCard.test.tsx`, add inside its `describe` block:

```tsx
  it('uses the warm accent on the due-today headline when cards are due', () => {
    renderCard({ dueCount: 8, newCount: 0 });
    const headline = screen.getByText('8 כרטיסים לחזרה היום');
    expect(headline).toHaveClass('text-[var(--kb-accent-warm)]');
  });

  it('does not use the warm accent when nothing is due', () => {
    renderCard({ dueCount: 0, newCount: 5 });
    const headline = screen.getByText('אין חזרות מתוזמנות להיום');
    expect(headline).toHaveClass('text-[var(--kb-text)]');
    expect(headline).not.toHaveClass('text-[var(--kb-accent-warm)]');
  });
```

- [ ] **Step 4: Run the affected tests**

Run: `npx vitest run src/components/home/DashboardCard.test.tsx`
Expected: all pass, including the two new tests.

- [ ] **Step 5: Full verification and commit**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all green.

```bash
git add src/styles/tokens.css src/components/home/DashboardCard.tsx src/components/home/DashboardCard.test.tsx
git commit -m "feat: warm accent color for the due-today review nudge"
```

---

## Task 4: Layout density — tighten controls, loosen browse cards

**Files:**
- Modify: `kb-app/src/styles/index.css` (`.kb-topic-grid` gap)
- Modify: `kb-app/src/pages/Flashcards.tsx` (control row spacing)
- Modify: `kb-app/src/pages/Quiz.tsx` (control row spacing)
- Modify: `kb-app/src/pages/Map.tsx` (filter row + legend spacing)

**Interfaces:**
- Consumes: nothing from Tasks 1-3.
- Produces: nothing consumed by later tasks — this is a leaf, visual-only task.

No test changes in this task: every change below is a spacing-only className edit (no new element, no behavior change), and the existing test suites for these files query by role/text/label, not by gap/margin classes — they should pass unmodified. Step 5 confirms this.

- [ ] **Step 1: Loosen the Home browse-card grid**

In `kb-app/src/styles/index.css`, the `.kb-topic-grid` rule currently reads:

```css
.kb-topic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}
```

Change `gap: 1rem;` to `gap: 1.25rem;`.

- [ ] **Step 2: Tighten Flashcards' filter/control row**

In `kb-app/src/pages/Flashcards.tsx`, the control row currently reads:

```tsx
        <div className="mb-6 flex flex-wrap items-center gap-3">
```

Change to:

```tsx
        <div className="mb-4 flex flex-wrap items-center gap-2">
```

- [ ] **Step 3: Tighten Quiz's setup-screen filter/control row**

In `kb-app/src/pages/Quiz.tsx`, the control row currently reads:

```tsx
          <div className="mb-6 flex flex-wrap items-center gap-3">
```

Change to:

```tsx
          <div className="mb-4 flex flex-wrap items-center gap-2">
```

- [ ] **Step 4: Tighten Map's filter row and category legend**

In `kb-app/src/pages/Map.tsx`, the filter row currently reads (around line 108):

```tsx
        <div className="mb-4 flex flex-wrap items-center gap-3">
```

Change to:

```tsx
        <div className="mb-3 flex flex-wrap items-center gap-2">
```

The category legend currently reads (around line 139):

```tsx
        <ul aria-label="מקרא קטגוריות" className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--kb-text2)]">
```

Change to:

```tsx
        <ul aria-label="מקרא קטגוריות" className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--kb-text2)]">
```

- [ ] **Step 5: Run the affected tests**

Run: `npx vitest run src/pages/Flashcards.test.tsx src/pages/Quiz.test.tsx src/pages/Map.test.tsx`
Expected: all pass unmodified — these changes don't touch any queryable role, label, or text.

- [ ] **Step 6: Full verification and commit**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all green.

```bash
git add src/styles/index.css src/pages/Flashcards.tsx src/pages/Quiz.tsx src/pages/Map.tsx
git commit -m "style: tighten Flashcards/Quiz/Map control density, loosen Home browse grid"
```

---

## Task 5: Final verification and manual sign-off

**Files:** none (verification only).

- [ ] **Step 1: Full automated verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all four green, test count equal or higher than the pre-Task-1 baseline (no test deleted, several added).

- [ ] **Step 2: Manual pass — typography**

`npm run dev`. Visit Home, Flashcards, Quiz, Map, Settings, and a topic in Reader. Confirm: page titles and the listed section/card headings (Task 1's table) render in Rubik and are visually distinct from body text, in both light and dark theme, at both desktop and phone width. Confirm Hebrew glyphs render correctly (not tofu/fallback boxes) — Rubik's `hebrew` subset was confirmed in the spec, but a font-loading misconfiguration would only show up visually.

- [ ] **Step 3: Manual pass — shadows and warm accent**

Confirm `TopicCard`/`TopicListRow` (Home browse grid) and the three `DashboardCard` tiles show a visibly "lifted" shadow rather than the previous flatter one, in both themes. **If cards still read as same-plane-as-page rather than lifted**, raise `--kb-surface`'s lightness delta from `--kb-bg` slightly in `kb-app/src/styles/tokens.css` (light theme: nudge `--kb-surface` from `99.2%` toward `99.6%`; dark theme: nudge from `23%` toward `25%`) and re-run Step 1 — per the spec, this contrast delta was deliberately left for visual judgment rather than frozen here.

With at least one due flashcard (or temporarily set `dueCount` non-zero via the store in devtools if none are due), confirm the spaced-review headline's warm accent color is visually distinct from both the page's blue accent and the amber `--kb-cat-metrics` category color when both appear on screen together (e.g. a metrics-category topic card visible alongside the dashboard). **If they read as too similar, adjust `--kb-accent-warm`'s hue (currently 95) further from 75, or lower its chroma, in `kb-app/src/styles/tokens.css`, and re-run Step 1.**

- [ ] **Step 4: Manual pass — layout density**

Confirm Map/Flashcards/Quiz's filter rows read as tighter/less competing-for-attention than before, and Home's browse-card grid has visibly more breathing room between cards, in both themes and at phone width.

- [ ] **Step 5: Manual pass — RTL and keyboard (regression check)**

Confirm none of this pass's changes regressed RTL layout (headings/shadows/spacing are all logical-property-safe by construction — no `left`/`right` introduced) or keyboard navigation (no interactive elements were added or removed).

- [ ] **Step 6: Push**

```bash
git push
```
