# kb-app Visual Identity Refresh — Design

**Status:** Draft — awaiting your review before implementation planning.
**Depends on:** the shadcn/ui redesign merged to `master` at `f49484f` — this refresh is a visual layer on top of the shadcn/Radix primitives now in place (`Button`, `Card`, `Dialog`, `Sheet`, `Select`, etc.). It does not touch that component architecture.
**Scope boundary:** A systemic visual-identity pass — palette warmth/depth, a heading typeface, a secondary accent color, and per-screen layout density — addressing three named problems: the app currently reads as plain/clinical, cluttered/hard to scan in places, and inconsistent across screens. Audience is "me + others," so the result needs to hold up for people other than the maintainer.

## Goal

Make the app feel warmer and more intentional without becoming a rebrand: keep the existing blue accent family, the RTL-only layout, the attribute-based dark mode, and the `--kb-*` token architecture exactly as they are — change the *values* those tokens carry (shadows, a second accent, radius stays as-is since it's already on-target) and add one typographic voice for display headings. Layout density is tuned per screen rather than uniformly, since Home's browse cards and Map's control-dense UI don't have the same clutter problem today.

## Out of scope

- **Component architecture.** shadcn/Radix primitives, their ARIA semantics, and their behavior are untouched — this pass only changes className/token values on top of them.
- **Information architecture.** No new pages, no navigation restructuring, no change to what's shown on which screen — only how much and how tightly.
- **`.kb-topic-content`** — the raw topic-article HTML/CSS. Golden rule 1 in `kb-app/CLAUDE.md`. Never touched.
- **Brand hue rotation.** `--kb-accent` stays in its current blue family (`oklch(* * 260)`). This is a warmth pass, not a rebrand — a hue change would be a much bigger, riskier decision than what was asked for.
- **`lib/theme.ts`'s dark-mode mechanism, RTL `dir` handling, or the `--kb-*` token architecture itself** — only token *values* change, never the mechanism reading them.
- **Iconography.** Lucide stays the icon set; no new icon style.
- **Border-radius.** Already at 10px (controls) / 12px (cards) / pill (status), which is inside Soft UI Evolution's own 8–12px target range. Nothing to change here.

## Section 1: Typography — a heading voice

**Body/UI text stays Heebo** (`--kb-font-sans`, already loaded via `@fontsource/heebo`, Hebrew-native, no change).

**Add Rubik for display headings.** Rubik is a Hebrew+Latin variable sans (designer: Hubert & Fischer / Meir Sadan for Google Fonts) with soft, rounded terminals — the most common choice for "friendly, approachable" product UI in Hebrew (Wix, Fiverr, and most Israeli consumer SaaS use it for this exact reason). This is the single highest-visibility change in this pass and directly targets "plain/clinical."

- Add `@fontsource/rubik` (weights 600/700/800 — headings only, no need for the full range Heebo carries), imported in `src/main.tsx` next to the existing Heebo imports.
- New token in `tokens.css`: `--kb-font-heading: 'Rubik', var(--kb-font-sans);` (falls through to Heebo, then the existing system stack).
- **Apply it narrowly, not via a global `h1,h2,h3` CSS rule.** A blanket tag-selector would also re-font small `text-xs` navigational labels that are currently `<h2>` for landmark/semantic reasons (`Sidebar`'s module-group label, `ReaderAside`'s section headings, `TableOfContents`'s heading) — those function as UI chrome, not display type, and mixing typefaces at 12px reads as noisier, not calmer. Instead, apply `font-[var(--kb-font-heading)]` (matching this codebase's existing arbitrary-value Tailwind convention, e.g. `text-[var(--kb-text)]`) directly to the handful of true page-title/card-title headings: the page `<h1>`s in `Flashcards.tsx`, `Map.tsx`, `Quiz.tsx` (×2), `Settings.tsx`, `NotFound.tsx`; `TopicCard.tsx`'s `<h3>`; `RelatedTopics.tsx`'s `<h2>`; `Flashcards.tsx`'s in-session `<h2>` (current topic title). `Home.tsx`'s `<h1>` is `sr-only` — skip it, nothing to see. The implementation plan should confirm this list against the live files rather than trust it verbatim, the way the shadcn plan's own Task 17 caught drift from its mapping table.

## Section 2: Depth — softer, layered shadows

Current shadows are flat, single/double-layer, and read as slightly harsh at card scale — a direct contributor to "clinical." Move to a Soft UI Evolution-style layered shadow for card surfaces specifically (a new token, not a replacement of the existing generic `--kb-shadow-sm/md/lg`, which stay for smaller-scale elements like dropdowns/popovers):

```css
:root {
  --kb-shadow-card: 0 1px 2px oklch(20% 0.02 260 / 0.04), 0 8px 20px oklch(20% 0.02 260 / 0.07);
}
:root[data-theme="dark"] {
  --kb-shadow-card: 0 1px 2px oklch(0% 0 0 / 0.3), 0 8px 24px oklch(0% 0 0 / 0.35);
}
```

Wider spread, lower opacity per layer than today's `--kb-shadow-md` — the "lifted, not boxed" quality Soft UI Evolution targets. Applied to `Card`-wrapped surfaces (`TopicCard`, `TopicListRow`, `DashboardCard`) in place of whatever shadow they currently inherit. Also raise surface-to-card contrast slightly (`--kb-surface` vs `--kb-bg` delta) so cards read as sitting *above* the page rather than same-plane-different-outline — exact delta is a judgment call for implementation, verified visually (both themes), not a value to freeze here.

## Section 3: A second, warm accent

For streaks, due-today counts, and celebratory/completion states — visually distinct from both `--kb-accent` (blue, brand) and the five existing category hues (algorithms 250° blue, concepts 165° green, **metrics 75° amber**, formulas 320° magenta, **architectures 25° red-orange**). Landing a "warm highlight" hue between metrics and architectures would read as a 6th category color, which is the wrong signal — it needs to be recognizably *not* a category chip.

Proposed starting point, differentiated by hue *and* lower chroma (softer/glowier than the punchier category chips):

```css
:root {
  --kb-accent-warm: oklch(78% 0.11 95);       /* warm gold, muted vs. category hues */
  --kb-on-accent-warm: oklch(25% 0.02 95);
}
:root[data-theme="dark"] {
  --kb-accent-warm: oklch(80% 0.10 95);
  --kb-on-accent-warm: oklch(20% 0.02 95);
}
```

**These exact numbers need a visual pass before they ship** — the same "no subagent in this run has a browser" limitation that bit the shadcn migration applies here even harder, since color-adjacency judgment (does this actually read as distinct from `--kb-cat-metrics` next to it on screen, in both themes) isn't something source-reading can verify. Treat this as a starting point the implementation confirms by eye, not a locked value — flag it explicitly in the plan's Definition of Done.

## Section 4: Layout density — per screen, not uniform

Density changes independently of the above and directly targets "cluttered/hard to scan." Not a single global spacing-scale change — the screens don't have the same problem:

- **Tighten:** Map's legend/controls, Flashcards/Quiz's control rows (status/count selects, action buttons) — currently competing for attention with the content below them.
- **Loosen:** Home's dashboard strip and browse card grid — more breathing room between cards, larger touch/scan targets, since this is the first-impression screen and currently reads as the most cluttered.
- **Unchanged:** Reader (content-focused, already spacious by necessity), Settings (already a simple stacked-sections layout).

Exact spacing values are an implementation-plan-level decision, verified per-screen against the actual rendered layout — this section sets *intent and priority order* (Map/Flashcards/Quiz tighten, Home loosens), not pixel values, deliberately: freezing spacing numbers without seeing them rendered would just repeat the mistake this whole pass is trying to fix.

## Testing & verification

Same Definition of Done as the shadcn migration (`kb-app/CLAUDE.md`): typecheck/lint/test/build green, both themes, RTL, keyboard. Additionally, because this pass is fonts/color/spacing rather than component behavior, automated tests verify very little of what actually matters here — **a human visual pass (light + dark, desktop + phone width) is not optional follow-up this time, it's the primary verification**, not a fallback for what automation missed.
