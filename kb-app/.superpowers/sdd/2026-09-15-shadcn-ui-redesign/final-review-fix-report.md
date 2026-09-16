# Final whole-branch review — fix wave report

Branch: `worktree-shadcn-ui-redesign` · Worktree: `kb-app` (shadcn/ui migration, 18 tasks / 28 commits)
Date: 2026-09-16

This is the fix wave for the final whole-branch review. All 14 findings below were
addressed in this worktree. Three commits were made (see "Commits" at the end).

## Findings

### 1. Quiz answer options overflow horizontally — no text wrap (Critical)

`src/pages/Quiz.tsx` — the option `Button` className gained `whitespace-normal` and
`h-auto` (kept the existing `min-h-11 py-2`) so long Hebrew option text wraps inside
the `max-w-xl` quiz container instead of forcing horizontal overflow.

No deviation from the suggested fix.

### 2. Icons forced to 16px via `[&_svg]:size-4`, ignoring explicit `size` props (Important)

Removed `[&_svg]:size-4` from `buttonVariants` in `src/components/ui/button.tsx` and
from `toggleVariants` in `src/components/ui/toggle.tsx`. `[&_svg]:pointer-events-none`
and `[&_svg]:shrink-0` were left in place (unrelated to sizing). Verified every call
site in the app already passes an explicit `size={N}` prop to its lucide icon, so no
call site needed touching.

No deviation.

### 3. Dialog/Sheet overlay hardcoded color instead of `--kb-overlay` token (Important)

`src/components/ui/dialog.tsx` and `src/components/ui/sheet.tsx`: `bg-black/80` →
`bg-[var(--kb-overlay)]` in both `DialogOverlay` and `SheetOverlay`.
Confirmed with a grep that `--kb-overlay` (`src/styles/tokens.css:27`) is now
referenced in `dialog.tsx` and `sheet.tsx` (previously unreferenced anywhere).

No deviation.

### 4. MobileDrawer backdrop stays visible with no panel across the `md` breakpoint (Important)

Read `sheet.tsx`'s `SheetContent`: it renders `<SheetPortal><SheetOverlay />` then
`SheetPrimitive.Content` — the overlay never receives `SheetContent`'s `className`.
Added a new optional `overlayClassName` prop to `SheetContentProps` in
`src/components/ui/sheet.tsx`, threaded through to `<SheetOverlay className={overlayClassName} />`.
`src/components/layout/MobileDrawer.tsx` now passes `overlayClassName="md:hidden"`
alongside the existing `md:hidden` on `SheetContent`'s own `className`, so the
backdrop is hidden together with the panel at desktop widths.

Deviation: the brief left the exact mechanism to judgment ("if `SheetContent`
accepts an overlay-specific prop, use it; otherwise..."). Chose to add a new
`overlayClassName` prop on the shared `SheetContent` rather than hardcoding
`md:hidden` into `SheetOverlay` itself, since `Sheet`/`SheetContent` is also used
elsewhere (not mobile-only) and a hardcoded `md:hidden` there would have broken
other call sites. This keeps the primitive generic and opt-in.

### 5. Settings buttons lost `w-fit`, now stretch full-width (Important)

Added `w-fit` to all six `Button` usages in `src/pages/Settings.tsx`: sign-out,
sync-now, send-login-link, install-app, export-data, import-data. `SECTION_CLASS`
itself was left untouched as instructed.

No deviation.

### 6. English "Close" accessible name in an all-Hebrew UI (Important)

Changed the sr-only `Close` span to `סגור` in both `src/components/ui/dialog.tsx`
and `src/components/ui/sheet.tsx`.

Updated tests that queried by the English string:
- `src/components/layout/MobileDrawer.test.tsx` — `getByRole('button', { name: 'Close' })`
  → `getByRole('button', { name: 'סגור' })` (only one close button in this component).
- `src/components/layout/ShortcutsHelp.test.tsx` — this component renders **two**
  buttons now both named `סגור` (its own visible "סגור" button plus the shadcn
  corner close button, which used to be the only one named "Close"). Updated all
  four assertions that referenced the close button by role/name
  (`getByRole('button', { name: 'סגור' })` at the corner-close test, the initial-focus
  test, the click test, and the focus-restore test) to `getAllByRole('button', { name: 'סגור' })[0]`
  (the visible button, first in DOM order — confirmed via `dialog.tsx`'s markup order:
  `{children}` then the corner `DialogPrimitive.Close`) or `[1]` for the corner-button
  test specifically.
- Grepped `CommandPalette.test.tsx` for `Close`/`/close/i` — no matches, no change
  needed there (it doesn't test the close button by that name).

Deviation: the brief anticipated updating "likely" `MobileDrawer.test.tsx` and/or
`ShortcutsHelp.test.tsx`/`CommandPalette.test.tsx`; in practice `ShortcutsHelp.test.tsx`
needed index-based disambiguation (`getAllByRole`) rather than a simple string swap,
because it now has two same-named buttons where before only one carried the "Close"
name.

### 7. Unnecessary TypeScript deprecation suppression (Important)

Deleted `"baseUrl": "."` and `"ignoreDeprecations": "6.0"` from
`tsconfig.app.json`. `npm run typecheck` passes cleanly afterward — `@/*` imports
still resolve via `paths` alone (TS 4.4+ resolves `paths` relative to the tsconfig
file with no `baseUrl`).

No deviation.

### 8. AccordionGroup chevron doesn't rotate (Important)

`src/components/browse/AccordionGroup.tsx`: the `ChevronDown` icon's className is now
conditional on the component's existing `expanded` prop:
`` `transition-transform duration-200 ${expanded ? '' : 'rotate-90'}` `` — rotated 90°
when collapsed, matching pre-migration behavior and the brief's suggested fix exactly.

No deviation.

### 9. TopicFavoriteButton `size="xs"` renders as an oval (Important)

`src/components/topic/TopicFavoriteButton.tsx`: `SIZE_CLASS.xs` changed from `'size-9'`
to `'size-9 min-w-0 p-0'`. This flows into `Toggle`'s `cn(toggleVariants({ variant,
size, className }))`, where `twMerge` resolves the conflict in favor of the later
occurrence regardless of source order — `min-w-0`/`p-0` (from `className`) win over
`toggleVariants`' default `min-w-10`/`px-3`, since `cva` places the passed `className`
last in its output. Verified `toggle.tsx` itself needed no change — the override is
correctly scoped to the one call site instead of every `Toggle` consumer.

No deviation.

### 10. Flashcards keyboard guard doesn't cover an open Select dropdown (Important)

`src/pages/Flashcards.tsx`'s `isTyping` guard now also checks
`event.target.closest('[role="combobox"],[role="listbox"],[role="option"]') !== null`.
Verified against the installed `@radix-ui/react-select` source
(`node_modules/@radix-ui/react-select/dist/index.mjs`): `SelectContentImpl` renders
its positioned content with `role: "listbox"` (line ~482) and each `SelectItem`
renders with `role: "option"` (line ~856) — both portaled outside the trigger, so
`event.target` while the dropdown is open lands on one of these, never on the
`role="combobox"` trigger. The `closest()` call catches trigger, listbox, and option
in one check, replacing the narrower `getAttribute('role') === 'combobox'` check
(kept as part of the same combined condition).

Added a regression test in `src/pages/Flashcards.test.tsx`:
`'ignores a rating-key shortcut fired while the select dropdown is open'` — reveals a
card, clicks the status trigger to actually open the dropdown, grabs the resulting
`role="listbox"` element via `findByRole`, fires a `3` keydown on it, and asserts no
card was graded. The existing "focused trigger" regression test (Task 17) was left
in place unchanged since it covers a different interaction (focused-but-closed).

No deviation.

### 11. Physical-direction CSS utilities break in RTL (Should-fix)

- `src/components/ui/dialog.tsx`: close button `right-4 top-4` → `end-4 top-4`.
- `src/components/ui/sheet.tsx`: close button `right-4 top-4` → `end-4 top-4`.
- `src/components/ui/command.tsx`: search icon `mr-2` → `me-2`.
- `select.tsx`'s `left-2` check-indicator left untouched, as instructed.

No deviation.

### 12. Touch targets shrank from `min-h-11` to shadcn's 40px default (Should-fix)

Restored `min-h-11` on:
- `src/components/layout/Header.tsx` — install-app button.
- `src/pages/Home.tsx` — clear-filters button.
- `src/pages/Flashcards.tsx` — practice-all-cards, restart-session ("סבב נוסף",
  previously had no className at all), reveal button (previously no className), and
  all 4 RATINGS buttons.
- `src/pages/Quiz.tsx` — start ("התחל מבחן", previously no className), new-quiz
  ("מבחן חדש"), next ("הבא"). The answer-option buttons were **not** touched here —
  they already carry `min-h-11` and were separately handled in finding #1's
  wrapping fix.

No deviation. Two buttons (Flashcards reveal/restart-session, Quiz start) had no
`className` prop before; added one with just `min-h-11` in those cases.

### 13. Reader loading skeleton lost CLS-reservation min-height (Minor)

`src/components/reader/TopicReader.tsx`: added `min-h-96` to the skeleton wrapper
`div` (`role="status" aria-busy="true"`).

No deviation.

### 14. CLAUDE.md structure section doesn't mention `src/components/ui/` (Minor)

`kb-app/CLAUDE.md`'s "מבנה" line now reads:
`` `src/components` UI טהור (`src/components/ui/` — פרימיטיבים של shadcn/ui) · ... ``
— one parenthetical addition, matching the existing terse Hebrew per-directory style.

No deviation.

## Out of scope (confirmed untouched)

Per the brief's explicit "Do NOT fix" list: `CommandDialog` dead code, Radix's
dev-only "Missing Description" warning, `AccordionGroup`'s `<h3>` heading level,
`CardProps` export barrel, `StatusSegmented`'s implicit `flex`, duplicated jsdom
pointer-capture/scrollIntoView stubs, `lockBodyScroll.ts` dead code, `alert.tsx`'s
latent icon classes, destructive-token contrast, background-color drift, and
`AccordionGroup`'s missing `<section>` wrapper. None of these files were modified
except where a listed finding also required touching them (none did).

## Verification (full suite, run after all fixes)

### `npm run typecheck`
```
> kb-app@0.0.0 typecheck
> tsc -b
```
Clean, no errors.

### `npm run lint`
```
> kb-app@0.0.0 lint
> eslint .

src/components/ui/button.tsx
  56:18  warning  Fast refresh only works when a file only exports components...

src/components/ui/toggle.tsx
  45:18  warning  Fast refresh only works when a file only exports components...

✖ 2 problems (0 errors, 2 warnings)
```
0 errors. Both warnings are pre-existing scaffolded-shadcn patterns (exporting
`buttonVariants`/`toggleVariants` alongside the component) — not introduced or
worsened by this fix wave (the `[&_svg]:size-4` removal in finding #2 touched these
same files but not the export shape that triggers the warning).

### `npx vitest run`
```
 Test Files  62 passed (62)
      Tests  543 passed (543)
   Duration  14.15s
```
All green, including the two updated test files (`ShortcutsHelp.test.tsx`,
`MobileDrawer.test.tsx`) and the new Flashcards regression test.

### `npm run build`
```
> tsc -b && vite build
...
✓ built in 614ms
PWA v1.3.0
mode      generateSW
precache  28 entries (1171.21 KiB)
files generated
  dist/sw.js
  dist/workbox-ebea30cf.js
```
Succeeds. The "chunks larger than 600 kB" warning is pre-existing (unrelated to this
fix wave — no new large dependency was introduced).

## Files changed

- `kb-app/CLAUDE.md`
- `kb-app/tsconfig.app.json`
- `kb-app/src/components/ui/button.tsx`
- `kb-app/src/components/ui/toggle.tsx`
- `kb-app/src/components/ui/dialog.tsx`
- `kb-app/src/components/ui/sheet.tsx`
- `kb-app/src/components/ui/command.tsx`
- `kb-app/src/components/ui/select.tsx` — **not modified** (verified `left-2` is
  intentional, per brief)
- `kb-app/src/components/layout/MobileDrawer.tsx`
- `kb-app/src/components/layout/MobileDrawer.test.tsx`
- `kb-app/src/components/layout/ShortcutsHelp.test.tsx`
- `kb-app/src/components/layout/Header.tsx`
- `kb-app/src/components/browse/AccordionGroup.tsx`
- `kb-app/src/components/topic/TopicFavoriteButton.tsx`
- `kb-app/src/components/reader/TopicReader.tsx`
- `kb-app/src/pages/Quiz.tsx`
- `kb-app/src/pages/Settings.tsx`
- `kb-app/src/pages/Home.tsx`
- `kb-app/src/pages/Flashcards.tsx`
- `kb-app/src/pages/Flashcards.test.tsx`
