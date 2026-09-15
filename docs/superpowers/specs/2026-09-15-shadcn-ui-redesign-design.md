# shadcn/ui Redesign — Design

**Status:** Approved, ready for implementation planning.
**Depends on:** nothing new — the app already builds and passes typecheck/lint/test on `master` (commit `aa79dfc`). No backend, schema, or content changes are involved.
**Scope boundary:** Adopt shadcn/ui as the component layer across the whole app (Header, Sidebar, TabBar, MobileDrawer, CommandPalette, ShortcutsHelp, ThemeToggle, and every page: Home, Reader, Flashcards, Quiz, Map, Settings), in one continuous pass rather than a phased rollout. Delivered via the `ui-ux-pro-max:ui-styling` skill's core stack (shadcn/ui + Tailwind CSS), migrated in place onto the existing design rather than a fresh visual direction.

## Goal

Replace hand-built interactive components with shadcn/ui (Radix-based) primitives for consistency and built-in accessibility, while preserving the app's existing visual identity (the `--kb-*` OKLCH token palette), its RTL-only layout, its attribute-based dark mode switcher, and all currently-passing behavior (IndexedDB-backed favorites/status/notes, SRS scheduling, offline content caching). This is an architecture/consistency upgrade, not a re-skin — the site should look the same to a user who isn't looking closely, while three components' duplicated focus-trap/scroll-lock/Escape-handling code collapses onto shared Radix primitives.

## Out of scope

- **Any new visual direction.** Colors, typography, spacing scale, and overall layout stay as they are — this migration maps shadcn's expected CSS variable slots onto the *existing* `--kb-*` values, it does not introduce a new palette (except one net-new `destructive` color, see Section 1).
- **Content markup.** `.kb-topic-content` styling (the raw HTML injected via `dangerouslySetInnerHTML` for topic articles — headings, tables, formulas, code blocks) is untouched. Golden rule 1 in `kb-app/CLAUDE.md` forbids changing topic text/markup; none of the mapped components touch it.
- **`next-themes` or any dark-mode architecture change.** `lib/theme.ts`'s attribute-based, flash-free, OS-synced switcher stays exactly as it is.
- **A phased/incremental rollout.** Decided during brainstorming: everything ships in one pass rather than a proof-of-concept page first.
- **`react-hook-form`/`zod`.** Settings' one-field magic-link form doesn't need a form library; it keeps native validation with shadcn `Input`/`Label`/`Button`.
- **A circular `Progress` equivalent.** shadcn's `Progress` is a horizontal bar; `DashboardCard`'s `ProgressRing` (custom SVG, already correctly `role="progressbar"`) stays custom.

## Section 1: Setup & token mapping

**Dependencies added:** `class-variance-authority`, `tailwind-merge`, `clsx`, `@radix-ui/react-direction`, and the Radix package backing each shadcn primitive added: `@radix-ui/react-dialog` (backs both `Dialog` and `Sheet`), `@radix-ui/react-select`, `@radix-ui/react-accordion`, `@radix-ui/react-toggle`, `@radix-ui/react-toggle-group`, `@radix-ui/react-label`, plus `cmdk` (the library shadcn's `Command`/`CommandDialog` wraps — not a Radix package). `lucide-react` is already a dependency — no change.

**Path alias:** shadcn's CLI expects `@/*`. Add to `tsconfig.app.json` (`compilerOptions.paths`) and `vite.config.ts` (`resolve.alias`). `components.json` uses this alias for new `src/components/ui/*` files only — existing files keep their current relative-import style; this is not a repo-wide import rewrite.

**`src/lib/utils.ts`:** new file, the standard shadcn `cn()` helper (`clsx` + `tailwind-merge`).

**Token mapping** (`src/styles/tokens.css`): rather than accepting `shadcn init`'s own default palette, hand-write the mapping so shadcn's expected slots resolve to the existing values, inside `:root` (and therefore automatically following `:root[data-theme="dark"]` with no separate dark block needed, since these all reference `--kb-*` custom properties rather than literal colors):

```css
:root {
  --background: var(--kb-bg);       --foreground: var(--kb-text);
  --card: var(--kb-surface);        --card-foreground: var(--kb-text);
  --popover: var(--kb-surface);     --popover-foreground: var(--kb-text);
  --primary: var(--kb-accent);      --primary-foreground: var(--kb-on-accent);
  --secondary: var(--kb-surface2);  --secondary-foreground: var(--kb-text);
  --muted: var(--kb-surface2);      --muted-foreground: var(--kb-muted);
  --accent: var(--kb-accent-soft);  --accent-foreground: var(--kb-accent);
  --destructive: oklch(58% 0.19 25); --destructive-foreground: #fff;
  --border: var(--kb-border);       --input: var(--kb-border-input);
  --ring: var(--kb-accent);         --radius: 0.625rem;
}
```

`--destructive` is a genuinely new color — nothing in `--kb-*` currently represents an error/danger state. Picked at the same lightness/chroma discipline as the rest of the palette, used by the Settings error message and the reader's offline-error `Alert`.

**Dark mode:** add a Tailwind v4 custom variant so shadcn's `dark:` classes key off the app's existing attribute instead of the `.dark` class shadcn assumes by default:
```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```
`lib/theme.ts` is not touched.

**Animation:** `tailwindcss-animate` is not Tailwind v4 compatible; use `tw-animate-css` (the v4-compatible successor shadcn's own v4 templates use) for the `animate-in`/`animate-out` classes shadcn's Dialog/Sheet/Accordion generated code expects.

## Section 2: Component inventory & mapping

Three components currently hand-roll near-identical focus-trap/Escape/scroll-lock/focus-restore logic independently: `MobileDrawer`, `ShortcutsHelp`, `CommandPalette`. Moving them onto Radix deletes all three duplicated implementations and every call site of `lib/lockBodyScroll.ts` they use. `CommandPalette` in particular already reinvented `role="combobox"` + listbox + arrow-key nav + `aria-activedescendant` — shadcn's `Command`/`CommandDialog` is built for exactly this pattern, with `lib/commandPalette.ts`'s filtering logic carried over unchanged (only the shell changes).

| Current component | → shadcn primitive | Notes |
|---|---|---|
| `MobileDrawer` | `Sheet` | shadcn's generated `Sheet` uses physical `left`/`right` side variants, not logical `start`/`end`; since this app is RTL-only, hardcode `side="right"` (today's `start-0` resolves to the same edge) rather than adding an unused direction variant. Drops custom focus-trap/scroll-lock code. |
| `ShortcutsHelp` | `Dialog` | drops custom focus-trap/scroll-lock code |
| `CommandPalette` | `Command` + `CommandDialog` | keeps `lib/commandPalette.ts` filtering as-is; only the shell (input/listbox markup, focus trap, Escape) changes |
| `SortMenu`'s native `<select>` | `Select` | |
| Settings email/text inputs | `Input` | |
| `StatusSegmented`, Settings theme radiogroup | `ToggleGroup` (`type="single"`) | Radix's single-select `ToggleGroup` renders `role="radiogroup"` / `role="radio"` / `aria-checked` — the *same* ARIA semantics the current hand-built markup uses, not a downgrade. Two independent hand-built "segmented control" implementations collapse into one primitive. |
| `TopicFavoriteButton` | `Toggle` | binary pressed state (`aria-pressed`) maps directly |
| `TopicStatusButton` | stays a plain `Button` (`variant="ghost" size="icon"`) | it *cycles* 3 states, not a boolean toggle — no Radix primitive fits better than what's already there |
| `AccordionGroup` | `Accordion` (`type="single" collapsible`, **one `Accordion` instance per module group**) | must stay one instance per group, each independently controlled — multiple module groups can be expanded simultaneously today, which a single shared `Accordion` instance would not allow |
| `TopicNotes` textarea | `Textarea` + `Label` | |
| Settings message banner, reader offline-error state | `Alert` | uses the new `--destructive` token for the error variant |
| `TopicCard`, `TopicListRow`, `DashboardCard` tiles | `Card` | shell only — existing `.kb-topic-card`/`.kb-topic-list-row` hover/active/stretched-link CSS in `index.css` stays, applied via `className` passthrough |
| Reader loading skeleton (`.kb-skeleton`) | `Skeleton` | same visual, standard primitive |
| Header/nav/all `<button>` actions | `Button` (variants `default`/`outline`/`ghost`, sizes incl. `icon`) | |
| `FilterChips`, category chips, status pills | **stays custom Tailwind**, restyled to the new radius/token scale | no interaction beyond a click — a Radix primitive adds nothing here (matches the skill's own "utility-first; extract only for true repetition" guidance) |
| `DashboardCard`'s `ProgressRing` (circular SVG) | **stays custom** | no shadcn/Radix equivalent (see Out of scope); existing `role="progressbar"`/`aria-value*` is already correct |

Everything not listed — Header layout, TabBar, Sidebar's list structure, Home/TopicReader page grids, RTL logical-property usage — keeps its current structure; only leaf controls change.

## Section 3: RTL & accessibility carryover

**Radix direction context:** Radix primitives don't read `<html dir="rtl">` automatically — they check a `dir` prop or a `DirectionProvider` context, defaulting to `"ltr"`. Wrap the app root once (`App.tsx`) in `<DirectionProvider dir="rtl">` from `@radix-ui/react-direction`; every Radix primitive's popper positioning (`Select`, `DropdownMenu`, `Command`) and arrow-key handling then flips correctly everywhere, with no per-component `dir` prop needed.

**Motion:** Radix/shadcn's open/close animations are plain CSS `animation`s, so the existing global rule (`@media (prefers-reduced-motion: reduce) { * { animation: none !important } }` in `src/styles/index.css`) already suppresses them. No new reduced-motion work.

**Focus rings:** Radix ships every primitive unstyled, so they inherit the app's existing global `:focus-visible { box-shadow: var(--kb-focus-ring) }` automatically. No per-component focus styling to write.

## Section 4: Rollout mechanics

Delivered as one continuous pass, but sequenced internally:

1. Install dependencies; add `components.json`, the `@/*` path alias, `src/lib/utils.ts`.
2. Token mapping layer (Section 1) + dark-mode custom variant — pure plumbing, no visual change yet.
3. Add each shadcn primitive via `npx shadcn add <name>` into `src/components/ui/*`: `button card dialog sheet select toggle toggle-group accordion textarea alert skeleton input label command`.
4. Swap leaf components in dependency order: shared chrome first (Header, `MobileDrawer`→`Sheet`, `ShortcutsHelp`→`Dialog`, `CommandPalette`→`Command`, `ThemeToggle`→`Button`), then per page — Home (`DashboardCard`/`FilterChips`/`AccordionGroup`/`SortMenu`), Reader (`ReaderAside`/`StatusSegmented`/`TopicNotes`/`TopicFavoriteButton`/`TopicStatusButton`), Settings (forms/`ToggleGroup`/`Alert`), then Flashcards/Quiz/Map (mostly `Button` swaps).
5. `.kb-topic-content` CSS is untouched throughout (Out of scope).

## Error handling / edge cases

- **Radix `Select`/`Command` popper positioning near viewport edges** (e.g. `SortMenu` in a narrow mobile viewport, `Command` results near the bottom of a short viewport): Radix's built-in collision detection handles this by default; no custom positioning logic needed, but must be checked manually per Definition of Done.
- **`AccordionGroup`'s independent multi-expand behavior**: since each module group must be its own `Accordion` instance (Section 2), the existing "expand all / collapse all" bulk actions in `Home.tsx` must keep driving each instance's controlled `value` independently — verify this explicitly during implementation, it's the one place a naive single-shared-`Accordion` refactor would silently break existing behavior.
- **Existing IndexedDB-backed state** (favorites, progress status, notes, SRS cards): none of this is touched — every swapped component keeps calling the same `useUserDataStore`/`useUiStore` selectors and actions it does today; only the rendered markup changes.

## Testing

- Every component being swapped has a same-named `.test.tsx` file. Roles/labels carry over for most swaps (Section 3), so most tests should need no changes; `Select`, `Dialog`/`Sheet`, and `Command` swaps change DOM structure (Radix portals, conditional mounting) enough that those specific test files need rewrites (e.g. `within(screen.getByRole('dialog'))`), not just pass silently.
- No new application logic is introduced — this is a component-layer migration, so no new unit tests beyond adjusting existing ones for structural changes.
- Manual verification per component as it's swapped (not deferred to the end): light + dark theme, RTL layout, keyboard navigation, screen-reader label sanity check.

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green in `kb-app/`.
- Every component listed in Section 2's mapping table is migrated; nothing left half-swapped.
- Manually checked in light and dark, RTL correct, keyboard-navigable, no hardcoded colors bypassing the token layer — per component as it lands, matching this repo's own `CLAUDE.md` "definition of done."
- `AccordionGroup`'s independent-multi-expand behavior and Home's "expand all / collapse all" actions verified working (the one behavioral risk called out in Error handling).
- No regressions in `.kb-topic-content` rendering (untouched, but verify no shared CSS class collision was introduced by new shadcn component class names).
