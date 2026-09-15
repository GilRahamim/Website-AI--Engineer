# shadcn/ui Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate kb-app's hand-built interactive components onto shadcn/ui (Radix-based) primitives in place, across the whole app, while keeping the existing `--kb-*` OKLCH visual identity, RTL-only layout, and attribute-based dark mode switcher unchanged.

**Architecture:** shadcn's expected CSS variable slots (`--background`, `--primary`, `--border`, etc.) are mapped directly onto the existing `--kb-*` custom properties, so every added primitive matches the current palette in both themes with zero new color decisions except one net-new `--destructive`. Components are swapped file-by-file, keeping each component's existing props/API so call sites don't change signatures; three components (`MobileDrawer`, `ShortcutsHelp`, `CommandPalette`) that each hand-roll their own focus-trap/Escape/scroll-lock logic collapse onto shared Radix primitives.

**Tech Stack:** React 19, Vite 8, TypeScript 6, Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first config, no `tailwind.config.js`), shadcn/ui (CLI-scaffolded, Radix UI primitives + `cmdk`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-15-shadcn-ui-redesign-design.md`

## Global Constraints

- App is RTL-only (`<html dir="rtl">`, `kb-app/index.html`) — never LTR. Radix's `DirectionProvider` is fixed to `dir="rtl"`, not dynamic.
- Dark mode is attribute-based (`document.documentElement.setAttribute('data-theme', 'dark')`, `kb-app/src/lib/theme.ts`) — never switch to a `.dark` class or `next-themes`. Every shadcn `dark:` class must key off `[data-theme="dark"]` via a custom Tailwind variant.
- `--kb-*` custom properties (`kb-app/src/styles/tokens.css`) remain the single source of truth for color. shadcn's variable slots reference `--kb-*` values; never hardcode a literal color in a new shadcn variable.
- `.kb-topic-content` CSS and the raw HTML it styles (topic article markup) must never be touched — golden rule 1 in `kb-app/CLAUDE.md`.
- No `tailwind.config.js` — this is Tailwind v4; all config lives in `kb-app/src/styles/tokens.css` / `kb-app/src/styles/index.css` via `@theme`, `@custom-variant`, and plain CSS.
- No `react-hook-form` or `zod` — not introduced by this migration.
- `AccordionGroup` must remain independently controlled per module group — never collapse multiple groups into one shared `Accordion` instance (would break simultaneous multi-expand, an existing behavior).
- Definition of done, per task: `npm run typecheck && npm run lint && npm run test && npm run build` green in `kb-app/`, manually checked in light + dark + RTL + keyboard, per `kb-app/CLAUDE.md`'s own "definition of done."
- All commands below run with `kb-app/` as the working directory unless stated otherwise.

---

## Task 1: Project setup — dependencies, path alias, `components.json`, `cn()`

**Files:**
- Modify: `kb-app/package.json`
- Modify: `kb-app/tsconfig.app.json`
- Modify: `kb-app/vite.config.ts`
- Create: `kb-app/components.json`
- Create: `kb-app/src/lib/utils.ts`
- Test: `kb-app/src/lib/utils.test.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` from `src/lib/utils.ts` — every later shadcn component imports this.
- Produces: `@/*` path alias resolving to `kb-app/src/*`.

- [ ] **Step 1: Install dependencies**

```bash
npm install class-variance-authority clsx tailwind-merge @radix-ui/react-direction tw-animate-css
```

- [ ] **Step 2: Add the `@/*` path alias**

In `kb-app/tsconfig.app.json`, add to `compilerOptions`:

```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

In `kb-app/vite.config.ts`, add the import and `resolve.alias`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    // ...unchanged
```

(Insert `resolve` as a new top-level key in the config object; leave `plugins`/`build` exactly as they are today.)

- [ ] **Step 3: Write the failing test for `cn()`**

```ts
// kb-app/src/lib/utils.test.ts
import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges class lists and drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('lets a later Tailwind class win over an earlier conflicting one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: FAIL — `Cannot find module './utils'`

- [ ] **Step 5: Implement `cn()`**

```ts
// kb-app/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Create `components.json`** so the shadcn CLI knows where things live

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 8: Verify the app still builds with the new alias in place**

Run: `npm run typecheck && npm run build`
Expected: both succeed, no output change (nothing imports `@/*` yet — this only proves the alias resolves).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.app.json vite.config.ts components.json src/lib/utils.ts src/lib/utils.test.ts
git commit -m "chore: add shadcn/ui tooling (deps, path alias, cn helper)"
```

---

## Task 2: Token mapping layer + dark-mode custom variant

**Files:**
- Modify: `kb-app/src/styles/tokens.css`
- Modify: `kb-app/src/styles/index.css`

**Interfaces:**
- Produces: CSS variables `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--radius` — every shadcn component added in Task 3+ consumes these by name.
- Produces: a `dark:` Tailwind variant that activates under `[data-theme="dark"]`.

This task adds CSS only — no component consumes these variables yet, so there is no visible change to verify beyond "the build still succeeds and every existing page renders pixel-identical."

- [ ] **Step 1: Add the shadcn variable mapping to `tokens.css`**

Append to the end of `kb-app/src/styles/tokens.css` (after the existing `:root[data-theme="dark"]` block — these new rules stay in the theme-agnostic `:root` block below, since they reference `--kb-*` variables that already flip per theme):

```css

/* shadcn/ui variable mapping — points at the existing --kb-* tokens above,
   so every shadcn component matches this palette in both themes with no
   separate dark block: --kb-* already flips under [data-theme="dark"]. */
:root {
  --background: var(--kb-bg);
  --foreground: var(--kb-text);
  --card: var(--kb-surface);
  --card-foreground: var(--kb-text);
  --popover: var(--kb-surface);
  --popover-foreground: var(--kb-text);
  --primary: var(--kb-accent);
  --primary-foreground: var(--kb-on-accent);
  --secondary: var(--kb-surface2);
  --secondary-foreground: var(--kb-text);
  --muted: var(--kb-surface2);
  --muted-foreground: var(--kb-muted);
  --accent: var(--kb-accent-soft);
  --accent-foreground: var(--kb-accent);
  /* Net-new: nothing in --kb-* represents an error/danger state today.
     Same lightness/chroma discipline as the rest of the palette. */
  --destructive: oklch(58% 0.19 25);
  --destructive-foreground: #fff;
  --border: var(--kb-border);
  --input: var(--kb-border-input);
  --ring: var(--kb-accent);
  --radius: 0.625rem;
}
```

- [ ] **Step 2: Add the dark-mode custom variant and import `tw-animate-css` in `index.css`**

In `kb-app/src/styles/index.css`, after the existing `@import "./tokens.css";` line, add:

```css
@import "tw-animate-css";

/* shadcn/Radix components ship `dark:` classes; this app toggles theme via
   a data-theme attribute (lib/theme.ts), not shadcn's default .dark class —
   so `dark:` must key off the attribute instead. */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

- [ ] **Step 3: Verify no regression**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all four green, identical results to before this task (no component reads the new variables yet).

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css src/styles/index.css
git commit -m "style: map shadcn CSS variables onto existing --kb-* tokens"
```

---

## Task 3: Scaffold shadcn primitives + Radix `DirectionProvider`

**Files:**
- Create: `kb-app/src/components/ui/button.tsx`
- Create: `kb-app/src/components/ui/card.tsx`
- Create: `kb-app/src/components/ui/dialog.tsx`
- Create: `kb-app/src/components/ui/sheet.tsx`
- Create: `kb-app/src/components/ui/select.tsx`
- Create: `kb-app/src/components/ui/toggle.tsx`
- Create: `kb-app/src/components/ui/toggle-group.tsx`
- Create: `kb-app/src/components/ui/accordion.tsx`
- Create: `kb-app/src/components/ui/textarea.tsx`
- Create: `kb-app/src/components/ui/alert.tsx`
- Create: `kb-app/src/components/ui/skeleton.tsx`
- Create: `kb-app/src/components/ui/input.tsx`
- Create: `kb-app/src/components/ui/label.tsx`
- Create: `kb-app/src/components/ui/command.tsx`
- Modify: `kb-app/src/App.tsx`

**Interfaces:**
- Produces: `Button`/`buttonVariants`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`, `Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogClose`, `Sheet`/`SheetTrigger`/`SheetContent`/`SheetHeader`/`SheetTitle`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`, `Toggle`, `ToggleGroup`/`ToggleGroupItem`, `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent`, `Textarea`, `Alert`/`AlertTitle`/`AlertDescription`, `Skeleton`, `Input`, `Label`, `Command`/`CommandDialog`/`CommandInput`/`CommandList`/`CommandEmpty`/`CommandGroup`/`CommandItem` — every later task imports one or more of these from `@/components/ui/*`.
- Consumes: `cn()` from Task 1, CSS variables from Task 2.

- [ ] **Step 1: Run the shadcn CLI to scaffold every primitive this migration needs**

```bash
npx shadcn@latest add button card dialog sheet select toggle toggle-group accordion textarea alert skeleton input label command
```

Answer prompts (if any — `components.json` from Task 1 should suppress most): accept defaults; this also installs the matching Radix packages (`@radix-ui/react-dialog`, `-select`, `-accordion`, `-toggle`, `-toggle-group`, `-label`) and `cmdk` automatically.

- [ ] **Step 2: Verify the CLI output**

Run: `ls src/components/ui/`
Expected: 14 files listed above, all present.

Run: `npm run typecheck`
Expected: PASS — the generated files compile against the `--kb-*`-backed variables from Task 2 and the `cn()` helper from Task 1 with no errors.

- [ ] **Step 3: Wrap the app root in Radix's `DirectionProvider`**

Read `kb-app/src/App.tsx` first to find its top-level return. Add the import:

```tsx
import { DirectionProvider } from '@radix-ui/react-direction';
```

Wrap the existing top-level JSX the component returns in `<DirectionProvider dir="rtl">...</DirectionProvider>` (this app never runs LTR — see Global Constraints — so `dir` is a fixed literal, never a prop or piece of state).

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all four green.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui package.json package-lock.json src/App.tsx
git commit -m "chore: scaffold shadcn/ui primitives, wrap app in RTL DirectionProvider"
```

---

## Task 4: `ThemeToggle` → `Button`

**Files:**
- Modify: `kb-app/src/components/theme/ThemeToggle.tsx`
- Modify: `kb-app/src/components/theme/ThemeToggle.test.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button` (Task 3).

- [ ] **Step 1: Read the current test to confirm what must keep passing**

Read `kb-app/src/components/theme/ThemeToggle.test.tsx` in full before editing anything (its exact assertions on `aria-label` text and click behavior must still pass after the swap).

- [ ] **Step 2: Replace the hand-styled `<button>` with `Button`**

In `kb-app/src/components/theme/ThemeToggle.tsx`, replace the import line and the returned JSX:

```tsx
import { Moon, Sun } from 'lucide-react';
import { getCurrentTheme, setTheme } from '../../lib/theme';
import { Button } from '@/components/ui/button';

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(getCurrentTheme);

  useEffect(() => {
    function handleThemeChange() {
      setThemeState(getCurrentTheme());
    }
    window.addEventListener('kb-theme-change', handleThemeChange);
    return () => window.removeEventListener('kb-theme-change', handleThemeChange);
  }, []);

  function toggle() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'עבור לערכת נושא בהירה' : 'עבור לערכת נושא כהה'}
      className="size-11 rounded-[10px]"
    >
      {theme === 'dark' ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
    </Button>
  );
}
```

(Keep the existing `useState`/`useEffect` imports and hook body exactly as they are — only the returned element changes.)

- [ ] **Step 3: Run the component's test**

Run: `npx vitest run src/components/theme/ThemeToggle.test.tsx`
Expected: PASS with no test-file changes needed (`Button` forwards `aria-label`, `onClick`, and renders as a real `<button>`, so role/name/click queries are unaffected).

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all green.

- [ ] **Step 5: Manual check**

`npm run dev`, open the app, toggle theme via this button in both light and dark starting states; confirm the focus ring still appears on keyboard focus (Tab to it, don't click).

- [ ] **Step 6: Commit**

```bash
git add src/components/theme/ThemeToggle.tsx
git commit -m "refactor: migrate ThemeToggle to shadcn Button"
```

---

## Task 5: `MobileDrawer` → `Sheet`

**Files:**
- Modify: `kb-app/src/components/layout/MobileDrawer.tsx`
- Modify: `kb-app/src/components/layout/MobileDrawer.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` from `@/components/ui/sheet` (Task 3).
- Produces: same external API — `<MobileDrawer title={...}>{children}</MobileDrawer>` — reading from the same `useUiStore` `drawerOpen`/`setDrawerOpen` state. `AppChrome.tsx` (the only caller) needs no change.

- [ ] **Step 1: Read the current test first**

Read `kb-app/src/components/layout/MobileDrawer.test.tsx` in full. Note its exact queries (likely `getByRole('dialog')`, `getByText(title)`, a close-button query, Escape-key and backdrop-click assertions, and a `data-testid="drawer-backdrop"` query) — these are what Step 3 must reconcile against Radix's actual DOM.

- [ ] **Step 2: Replace `MobileDrawer.tsx`'s implementation**

```tsx
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface MobileDrawerProps {
  title: string;
  children: ReactNode;
}

/**
 * Slide-in panel for the sidebar's content on phones. Open state lives in
 * uiStore so the header's menu button and this panel stay decoupled.
 * Focus trap, Escape-to-close, backdrop click, and body scroll lock are
 * all handled by Radix's Dialog primitive underneath Sheet.
 */
export default function MobileDrawer({ title, children }: MobileDrawerProps) {
  const open = useUiStore((s) => s.drawerOpen);
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);

  return (
    <Sheet open={open} onOpenChange={setDrawerOpen}>
      <SheetContent
        side="right"
        className="w-[min(20rem,85vw)] gap-0 overflow-y-auto p-0 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b border-[var(--kb-border)] px-4 py-3">
          <SheetTitle className="text-base font-bold text-[var(--kb-text)]">{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
```

(shadcn's generated `SheetContent` already renders its own close button in the top corner with an `X` icon and `sr-only` "Close" label — this replaces the hand-written close `<button>` and the manual `X` import is dropped. If the scaffolded `sheet.tsx` from Task 3 does not include a close button, add one inside `SheetHeader` using the same pattern as `ShortcutsHelp` in Task 6.)

- [ ] **Step 3: Update the test file to match Radix's DOM**

Read the scaffolded `kb-app/src/components/ui/sheet.tsx` to confirm the exact `role` and close-button `aria-label`/accessible name Radix's `Dialog.Content` renders (Radix `Dialog.Content` is `role="dialog"` with `aria-modal="true"`; the close button typically has an `sr-only` "Close" text). Update `MobileDrawer.test.tsx`:
- Replace any `getByTestId('drawer-backdrop')` + `fireEvent.click` assertion with clicking `document.body` outside the `dialog` role element, or (simpler and equally valid) drop that specific backdrop-testid assertion and instead assert Escape-key closing (Radix handles both; testing one mechanism is sufficient once the backdrop is no longer a distinct testable element).
- Keep the `getByRole('dialog', { name: title })` assertion — Radix's `Dialog.Content` picks up `aria-labelledby` automatically from `SheetTitle`, so this still passes.
- Keep any focus-restoration assertion (Radix restores focus to the trigger on close) but drive open state through the store (`useUiStore.setState({ drawerOpen: true })`) rather than simulating a click on a removed custom trigger, matching how the component is actually opened in the app (via `Header`'s menu button dispatching `setDrawerOpen(true)`).

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/layout/MobileDrawer.test.tsx`
Expected: PASS. If a specific assertion still fails, read the actual rendered DOM (`screen.debug()`) to fix the query — do not weaken the assertion's intent (still verify: opens, shows title, Escape closes, focus returns to opener).

- [ ] **Step 5: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

- [ ] **Step 6: Manual check**

`npm run dev`, resize to a phone width, open the drawer via the header menu button — confirm it slides in from the right (RTL), Escape and backdrop click both close it, and closing returns focus to the menu button.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/MobileDrawer.tsx src/components/layout/MobileDrawer.test.tsx
git commit -m "refactor: migrate MobileDrawer to shadcn Sheet"
```

---

## Task 6: `ShortcutsHelp` → `Dialog`

**Files:**
- Modify: `kb-app/src/components/layout/ShortcutsHelp.tsx`
- Modify: `kb-app/src/components/layout/ShortcutsHelp.test.tsx`

**Interfaces:**
- Consumes: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogClose` from `@/components/ui/dialog`, `Button` from `@/components/ui/button` (Task 3).
- Produces: same external API — `<ShortcutsHelp open={open} onClose={onClose} />`. Caller (`App.tsx` or wherever it's mounted — verify) needs no change.

- [ ] **Step 1: Read the current test first**

Read `kb-app/src/components/layout/ShortcutsHelp.test.tsx` in full.

- [ ] **Step 2: Replace the implementation**

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: '/', description: 'מיקוד בחיפוש' },
  { keys: 'Esc', description: 'ניקוי חיפוש / סגירת חלונית' },
  { keys: '?', description: 'הצגת קיצורי המקלדת האלה' },
  { keys: '↑ ↓ → ←', description: 'ניווט בין כרטיסים' },
  { keys: 'Enter', description: 'פתיחת נושא' },
  { keys: 'Home / End', description: 'מעבר לכרטיס הראשון / האחרון' },
  { keys: 'Ctrl/Cmd + K', description: 'פתיחת חיפוש מהיר ופעולות' },
];

export default function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>קיצורי מקלדת</DialogTitle>
        </DialogHeader>
        <dl className="flex flex-col gap-2">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-center justify-between gap-4">
              <dt>
                <kbd className="rounded border border-[var(--kb-border-strong)] bg-[var(--kb-surface2)] px-2 py-1 font-mono text-sm">
                  {shortcut.keys}
                </kbd>
              </dt>
              <dd className="text-sm text-[var(--kb-text2)]">{shortcut.description}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
```

(`DialogContent` already renders its own close button and `role="dialog"`/`aria-modal`/focus-trap/Escape — the hand-written close `<button>`, `lockBodyScroll` import, and both `useEffect` focus-management blocks are all dropped.)

- [ ] **Step 3: Update the test file**

Read the scaffolded `kb-app/src/components/ui/dialog.tsx` to confirm the close button's accessible name (shadcn's default is an `sr-only` "Close"). Update `ShortcutsHelp.test.tsx` to query the close button by that name instead of the old `aria-label="סגור"` (or add `aria-label="סגור"` explicitly to a custom close button if you'd rather keep the Hebrew label — if so, pass `showCloseButton={false}` to `DialogContent` in Step 2 and render a manual close button matching the old markup, still inside `DialogContent`'s children). Prefer keeping the Hebrew label for consistency with the rest of the app's Hebrew UI — implement that variant:

```tsx
<DialogContent className="max-w-sm" showCloseButton={false}>
  <DialogHeader>
    <DialogTitle>קיצורי מקלדת</DialogTitle>
  </DialogHeader>
  {/* ...dl unchanged... */}
  <DialogClose asChild>
    <Button variant="outline" className="mt-2 w-full">
      סגור
    </Button>
  </DialogClose>
</DialogContent>
```

(Add `DialogClose` to the import line from `@/components/ui/dialog`, and `Button` from `@/components/ui/button`. Confirm `showCloseButton` is actually a prop on the scaffolded `DialogContent` — if the installed shadcn version doesn't expose it, instead leave the default `X` close button in the corner *and* keep this explicit "סגור" button at the bottom; both call the same `onOpenChange`, so having both is harmless.)

Update the test's close-button query to `getByRole('button', { name: 'סגור' })` — unchanged from before.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/layout/ShortcutsHelp.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

- [ ] **Step 6: Manual check**

Open with `?`, confirm Escape and the "סגור" button both close it, and focus returns to whatever had focus before opening.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/ShortcutsHelp.tsx src/components/layout/ShortcutsHelp.test.tsx
git commit -m "refactor: migrate ShortcutsHelp to shadcn Dialog"
```

---

## Task 7: `CommandPalette` → `Command` / `CommandDialog`

**Files:**
- Modify: `kb-app/src/components/palette/CommandPalette.tsx`
- Modify: `kb-app/src/components/palette/CommandPalette.test.tsx`

**Interfaces:**
- Consumes: `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem` from `@/components/ui/command` (Task 3). `lib/commandPalette.ts`'s `buildActionList`/`filterResults` (unchanged, existing).
- Produces: same external API — no props, mounted once, listens for `Ctrl/Cmd+K` and the `kb-open-palette` window event exactly as today.

- [ ] **Step 1: Read the current test first**

Read `kb-app/src/components/palette/CommandPalette.test.tsx` in full — note every query used against the old hand-rolled `listbox`/`option` markup.

- [ ] **Step 2: Replace the implementation**

`cmdk` (which shadcn's `Command` wraps) has its own built-in fuzzy filtering, keyboard nav, and `role="option"`/`aria-selected` handling — but this app's `filterResults` (which searches notes content and ranks actions vs. topics) must keep driving what's shown, so pass `shouldFilter={false}` to `Command` and keep feeding it the already-filtered list, same as today:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { searchIndex, topics } from '../../lib/catalog';
import type { Topic } from '../../types';
import { useUserDataStore } from '../../store/userDataStore';
import { buildActionList, filterResults, type PaletteAction } from '../../lib/commandPalette';
import { getCurrentTheme, setTheme } from '../../lib/theme';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const allActions = buildActionList();

const ACTION_ROUTES: Record<string, string> = {
  home: '/',
  flashcards: '/flashcards',
  quiz: '/quiz',
  map: '/map',
  settings: '/settings',
};

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    function toggle() {
      setOpen((wasOpen) => {
        const next = !wasOpen;
        if (next) setQuery('');
        return next;
      });
    }
    function handleGlobalKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'k' || event.code === 'KeyK')) {
        event.preventDefault();
        toggle();
      }
    }
    function handleOpenRequest() {
      setOpen((wasOpen) => {
        if (!wasOpen) setQuery('');
        return true;
      });
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('kb-open-palette', handleOpenRequest);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('kb-open-palette', handleOpenRequest);
    };
  }, []);

  const notes = useUserDataStore((s) => s.notes);
  const results = useMemo(() => filterResults(query, allActions, topics, searchIndex, notes), [query, notes]);

  function close() {
    setOpen(false);
  }

  function runAction(action: PaletteAction) {
    if (action.id === 'toggle-theme') {
      setTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
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

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false} title="חיפוש מהיר" description="חפש נושא או פעולה">
      <CommandInput placeholder="חפש נושא או פעולה..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>אין תוצאות</CommandEmpty>
        {results.actions.length > 0 && (
          <CommandGroup heading="פעולות">
            {results.actions.map((action) => (
              <CommandItem key={action.id} value={action.id} onSelect={() => runAction(action)}>
                {action.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.topics.length > 0 && (
          <CommandGroup heading="נושאים">
            {results.topics.map((topic) => (
              <CommandItem key={topic.id} value={topic.id} onSelect={() => openTopic(topic)}>
                <FileText aria-hidden="true" size={16} className="me-2 shrink-0 text-[var(--kb-muted)]" />
                {topic.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
```

(`CommandDialog`'s `title`/`description` props feed an internally-rendered visually-hidden `DialogTitle`/`DialogDescription` for accessibility — matching the old `<h2 id="command-palette-title" className="sr-only">` pattern. `lib/lockBodyScroll.ts`, both manual focus-management `useEffect`s, and the hand-written `role="combobox"`/`listbox`/`option`/`aria-activedescendant` markup are all dropped — `cmdk` provides the equivalent internally.)

- [ ] **Step 3: Update the test file**

Read the scaffolded `kb-app/src/components/ui/command.tsx` to confirm the roles `cmdk` renders (typically the input has no explicit `role="combobox"` override needed — `cmdk` manages `aria-selected` on `[cmdk-item]` elements). Update `CommandPalette.test.tsx`:
- Replace `getByRole('option', ...)` queries with the equivalent `cmdk`-rendered items — read `screen.debug()` output from a first failing run to get the exact accessible roles/names, then assert against those.
- Keep the same *behaviors* under test: opening via Ctrl/Cmd+K, opening via the `kb-open-palette` event, typing filters results (still driven by `filterResults`, so results content is identical), Enter activates the highlighted item and navigates via the mocked `useNavigate`, selecting the "toggle-theme" action calls `setTheme`.
- Arrow-key highlight-index tests: `cmdk` manages this internally now (no more `selectedIndex` state in the component) — assert on the resulting `data-selected`/`aria-selected` attribute of the expected item after `ArrowDown`/`ArrowUp` key presses instead of reading component state.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/palette/CommandPalette.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

- [ ] **Step 6: Manual check**

Ctrl+K to open, type a topic name, arrow through results, Enter to navigate; type an action name ("ערכת נושא" / theme), confirm it toggles theme and closes; confirm Escape closes and focus returns.

- [ ] **Step 7: Commit**

```bash
git add src/components/palette/CommandPalette.tsx src/components/palette/CommandPalette.test.tsx
git commit -m "refactor: migrate CommandPalette to shadcn Command"
```

---

## Task 8: `AccordionGroup` → `Accordion` (independently controlled per group)

**Files:**
- Modify: `kb-app/src/components/browse/AccordionGroup.tsx`
- Modify: `kb-app/src/components/browse/AccordionGroup.test.tsx`
- Reference (no change expected, verify only): `kb-app/src/pages/Home.tsx` (`expandAllGroups`/`collapseAllGroups`/`expandedGroups`/`toggleGroup` — confirm these still drive `AccordionGroup`'s `expanded`/`onToggle` props with no signature change)

**Interfaces:**
- Consumes: `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `@/components/ui/accordion` (Task 3).
- Produces: same external API — `<AccordionGroup group={...} expanded={boolean} onToggle={() => void} viewMode={...} highlightTerm={...} getItemProps={...} />`. `Home.tsx` needs no change.

- [ ] **Step 1: Read the current test first**

Read `kb-app/src/components/browse/AccordionGroup.test.tsx` in full.

- [ ] **Step 2: Replace the implementation**

Per Global Constraints, this stays **one independently-controlled `Accordion` instance per module group** — `type="single" collapsible`, with `value` driven by the existing `expanded` boolean prop, so `Home.tsx`'s expand-all/collapse-all logic (which toggles each group independently) keeps working unchanged:

```tsx
import { ChevronDown } from 'lucide-react';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import type { TopicGroup, ViewMode } from '../../types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import TopicGrid from './TopicGrid';
import TopicListRow from './TopicListRow';

interface AccordionGroupProps {
  group: TopicGroup;
  expanded: boolean;
  onToggle: () => void;
  viewMode: ViewMode;
  highlightTerm: string;
  getItemProps: (id: string) => GridItemProps;
}

export default function AccordionGroup({
  group,
  expanded,
  onToggle,
  viewMode,
  highlightTerm,
  getItemProps,
}: AccordionGroupProps) {
  return (
    <Accordion
      type="single"
      collapsible
      value={expanded ? group.moduleKey : ''}
      onValueChange={() => onToggle()}
      className="mb-6"
    >
      <AccordionItem value={group.moduleKey} className="rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface2)]">
        <AccordionTrigger className="min-h-11 px-4 py-2 text-start font-bold text-[var(--kb-text)] hover:no-underline [&>svg]:hidden">
          <span>{group.moduleLabel}</span>
          <span className="ms-auto flex items-center gap-2 text-sm font-normal text-[var(--kb-muted)]">
            {group.topics.length}
            <ChevronDown aria-hidden="true" size={18} className="transition-transform duration-200" />
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-0 pb-0 pt-3">
          {viewMode === 'grid' ? (
            <TopicGrid topics={group.topics} highlightTerm={highlightTerm} getItemProps={getItemProps} />
          ) : (
            <ul role="list" className="flex flex-col gap-2">
              {group.topics.map((topic) => (
                <li key={topic.id}>
                  <TopicListRow topic={topic} highlightTerm={highlightTerm} itemProps={getItemProps(topic.id)} />
                </li>
              ))}
            </ul>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
```

(`AccordionTrigger`'s scaffolded default already renders its own trailing chevron with a `data-state`-driven rotation — `[&>svg]:hidden` suppresses shadcn's default chevron so the existing custom one with the topic count badge next to it keeps its current layout instead of duplicating chevrons. `AccordionContent`'s built-in open/close animation is CSS `animation`-based, so it's already covered by the app's global `prefers-reduced-motion` rule per the spec's Section 3.)

- [ ] **Step 3: Update the test file**

Radix's `AccordionTrigger` renders as a `<button>` inside an `<h3>` by default with `aria-expanded`/`aria-controls`, matching the semantics of the old hand-built `<h2><button aria-expanded aria-controls>` closely enough that most role/name queries (`getByRole('button', { name: group.moduleLabel, ... })`) should still pass — but the heading level changes from `h2` to `h3` (shadcn's default). Update any heading-level assertion (`getByRole('heading', { level: 2, ... })`) to `level: 3`, or override it in Step 2 by passing `asChild` with a custom `<h2>` wrapper if the test's heading-level check is intentional page-structure semantics worth preserving (check `Home.tsx`'s other headings — if `h2` is the established level for section headings on that page, override to keep `h2`; read `Home.tsx` to decide before changing the test).

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/browse/AccordionGroup.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify `Home.tsx`'s expand-all/collapse-all still works**

Read `kb-app/src/pages/Home.tsx`'s `expandAllGroups`/`collapseAllGroups`/`expandedGroups`/`toggleGroup` implementation — confirm no change is needed (they operate on the `expandedGroups` Set/`toggleGroup` callback passed as `expanded`/`onToggle` props, unchanged by this task).

Run: `npx vitest run src/pages/Home.test.tsx`
Expected: PASS, including any existing "expand all" / "collapse all" test cases — this is the concrete check against the Error handling risk called out in the spec (independent multi-expand must not silently break).

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

- [ ] **Step 7: Manual check**

On Home, expand two different module groups at once (confirm both stay open simultaneously), then use "הרחב הכול" / "כווץ הכול" and confirm all groups respond.

- [ ] **Step 8: Commit**

```bash
git add src/components/browse/AccordionGroup.tsx src/components/browse/AccordionGroup.test.tsx
git commit -m "refactor: migrate AccordionGroup to shadcn Accordion, independently controlled per group"
```

---

## Task 9: `SortMenu` → `Select`; restyle `FilterChips`

**Files:**
- Modify: `kb-app/src/components/browse/SortMenu.tsx`
- Modify: `kb-app/src/components/browse/SortControls.test.tsx` (covers `SortMenu` — confirm exact filename by reading `kb-app/src/components/browse/` first if it differs)
- Modify: `kb-app/src/components/browse/FilterChips.tsx`
- Modify: `kb-app/src/components/browse/FilterChips.test.tsx`

**Interfaces:**
- Consumes: `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` from `@/components/ui/select` (Task 3).

- [ ] **Step 1: Read both current tests first**

Read `kb-app/src/components/browse/SortControls.test.tsx` and `kb-app/src/components/browse/FilterChips.test.tsx` in full.

- [ ] **Step 2: Replace `SortMenu.tsx`'s native `<select>`**

```tsx
import type { SortOrder } from '../../types';
import { useUiStore } from '../../store/uiStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'original', label: 'מקורי' },
  { value: 'alpha', label: 'א־ת' },
  { value: 'category', label: 'קטגוריה' },
];

export default function SortMenu() {
  const sortOrder = useUiStore((s) => s.sortOrder);
  const setSortOrder = useUiStore((s) => s.setSortOrder);

  return (
    <div className="flex items-center gap-2 text-sm text-[var(--kb-text)]">
      <span>מיון:</span>
      <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
        <SelectTrigger aria-label="מיין נושאים לפי" className="min-h-11 min-w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 3: Update `SortControls.test.tsx`**

Radix `Select` doesn't render a native `<select>`/`<option>` — a test that used `fireEvent.change` on a `<select>` must switch to: click the `SelectTrigger` (`getByRole('combobox', { name: 'מיין נושאים לפי' })`), then click the option (`getByRole('option', { name: '...' })`) in the opened `SelectContent` (rendered in a portal — Testing Library's `screen` queries search the whole document by default, so no special portal handling is needed). Confirm the resulting `useUiStore` state update the same way the old test did.

- [ ] **Step 4: Restyle `FilterChips.tsx`** — no primitive swap, just align to the new radius/token scale already in place elsewhere (per the spec, chips stay custom Tailwind):

Read the current file's exact classNames first (already using `--kb-*` tokens correctly); this step only needs a visual gut-check against the new `--radius: 0.625rem` scale introduced in Task 2 — if the existing `rounded-full` pill styling already reads consistently next to newly-migrated `Button`/`Card` components (both default to `rounded-md`, i.e. `var(--radius)`), leave `FilterChips.tsx` untouched. Verify visually in Step 7 rather than pre-emptively changing working code.

- [ ] **Step 5: Run both tests**

Run: `npx vitest run src/components/browse/SortControls.test.tsx src/components/browse/FilterChips.test.tsx`
Expected: PASS.

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

- [ ] **Step 7: Manual check**

On Home, open the sort select with keyboard (Tab to it, Enter/Space to open, arrow keys to move, Enter to select) and with mouse; confirm RTL popper positioning (opens aligned correctly, not off-screen) in both light and dark. Visually compare `FilterChips` pill styling against the newly-migrated `Button`/`Card` radius from other tasks once at least one of those has landed — if the pill radius now looks inconsistent, revisit Step 4.

- [ ] **Step 8: Commit**

```bash
git add src/components/browse/SortMenu.tsx src/components/browse/SortControls.test.tsx src/components/browse/FilterChips.tsx src/components/browse/FilterChips.test.tsx
git commit -m "refactor: migrate SortMenu to shadcn Select"
```

---

## Task 10: `TopicCard`, `TopicListRow`, `DashboardCard` tiles → `Card`

**Files:**
- Modify: `kb-app/src/components/browse/TopicCard.tsx`
- Modify: `kb-app/src/components/browse/TopicCard.test.tsx`
- Modify: `kb-app/src/components/browse/TopicListRow.tsx`
- Modify: `kb-app/src/components/home/DashboardCard.tsx`
- Modify: `kb-app/src/components/home/DashboardCard.test.tsx`

**Interfaces:**
- Consumes: `Card` from `@/components/ui/card` (Task 3).

This is a shell-only change: `Card` replaces the outer `<div>`/`<Link>` wrapper's className string, while every existing custom class (`.kb-topic-card`, `.kb-topic-list-row`, the `tileClass` constant's border/shadow/radius) is passed straight through via `className` — the hover/active/stretched-link CSS in `kb-app/src/styles/index.css` (Section: "Unlayered rules beat Tailwind's utility layer...") already targets these classNames generically and needs no change.

- [ ] **Step 1: Read the current tests first**

Read `kb-app/src/components/browse/TopicCard.test.tsx` and `kb-app/src/components/home/DashboardCard.test.tsx` in full.

- [ ] **Step 2: Wrap `TopicCard`'s outer element in `Card`**

`TopicCard.tsx`'s return is wrapped in `/* eslint-disable react-hooks/refs */` / `/* eslint-enable react-hooks/refs */` comments (the ref forwarded through `itemProps.ref` trips the rule's name-based heuristic) — keep those comments exactly where they are, immediately outside the `return (...)`. Replace only the outer `<div>`:

```tsx
import { Card } from '@/components/ui/card';
// ...existing imports stay

  /* eslint-disable react-hooks/refs -- itemProps.ref is a plain callback-ref forwarded from
     useGridKeyboardNav's roving-tabindex GridItemProps, never a ref.current read; the rule's
     name-based heuristic misidentifies the whole itemProps object because it has a property
     literally named "ref". */
  return (
    <Card className="kb-topic-card relative flex flex-col gap-2 p-4 transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]">
      {/* existing children unchanged: the category-chip/status/favorite row and the stretched-link Link */}
    </Card>
  );
  /* eslint-enable react-hooks/refs */
```

`Card`'s own default classes (`rounded-xl border bg-card text-card-foreground shadow`) are additive with `kb-topic-card`'s own `border-radius`/`border`/`background`/`box-shadow` via `cn()`'s Tailwind-merge — since `kb-topic-card` sets these via a plain CSS class (not Tailwind utilities), there's no `tailwind-merge` conflict to resolve; visually confirm in Step 7 that `bg-card` (→ `var(--kb-surface)` per Task 2) and `.kb-topic-card`'s own `background: var(--kb-surface)` agree (they do — same token), so no double-styling issue.

- [ ] **Step 3: Apply the same wrapper change to `TopicListRow.tsx`** — same `eslint-disable`/`eslint-enable react-hooks/refs` comment pair around its return, replace only the outer `<div>`:

```tsx
  /* eslint-disable react-hooks/refs -- see TopicCard.tsx for rationale */
  return (
    <Card className="kb-topic-list-row relative flex min-h-16 items-center gap-3 px-3 py-2.5 transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]">
      {/* existing children unchanged: the category dot, the stretched-link Link, and the status/favorite controls */}
    </Card>
  );
  /* eslint-enable react-hooks/refs */
```

- [ ] **Step 4: Apply the same wrapper change to `DashboardCard.tsx`'s three tiles** (the `tileClass` constant's wrapped elements) — replace each `<div className={tileClass}>` with `<Card className={tileClass}>` (keep the constant as-is, since it still carries the token-based border/shadow/radius); the one tile that's a `<Link>` (the "continue reading" tile) needs `Card` combined via `asChild`:

```tsx
<Card asChild className={`${tileClass} justify-between no-underline hover:border-[var(--kb-border-strong)] hover:bg-[var(--kb-surface2)]`}>
  <Link to={`/topic/${encodeURIComponent(continueTopic.id)}`}>
    {/* existing children unchanged */}
  </Link>
</Card>
```

(`asChild` makes `Card` merge its props/className onto its single child instead of rendering its own `<div>` — confirm the scaffolded `card.tsx` from Task 3 supports `asChild`; if it doesn't by default, add `import { Slot } from '@radix-ui/react-slot'` support to `Card` following the same `asChild` pattern already used in the scaffolded `Button`.)

- [ ] **Step 5: Run both tests**

Run: `npx vitest run src/components/browse/TopicCard.test.tsx src/components/home/DashboardCard.test.tsx`
Expected: PASS with no query changes needed (role/text content unchanged — only the wrapping element's tag name changes from `div` to `div`, since `Card` renders a `div` by default; `getByRole`/`getByText` queries are unaffected).

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

- [ ] **Step 7: Manual check**

On Home, confirm topic cards/list rows still show the hover-lift and active-press animation from `.kb-topic-card:hover`/`:active` in `index.css`, in both grid and list view, in both themes.

- [ ] **Step 8: Commit**

```bash
git add src/components/browse/TopicCard.tsx src/components/browse/TopicCard.test.tsx src/components/browse/TopicListRow.tsx src/components/home/DashboardCard.tsx src/components/home/DashboardCard.test.tsx
git commit -m "refactor: wrap TopicCard, TopicListRow, DashboardCard tiles in shadcn Card"
```

---

## Task 11: `TopicFavoriteButton` → `Toggle`

**Files:**
- Modify: `kb-app/src/components/topic/TopicFavoriteButton.tsx`
- Modify: `kb-app/src/components/topic/TopicFavoriteButton.test.tsx`

**Interfaces:**
- Consumes: `Toggle` from `@/components/ui/toggle` (Task 3).
- Produces: same external API — `<TopicFavoriteButton topicId={string} size?: 'xs'|'sm'|'lg' tabIndex?={number} />`.

- [ ] **Step 1: Read the current test first**

Read `kb-app/src/components/topic/TopicFavoriteButton.test.tsx` in full — it tests the `xs`/`sm`/`lg` size variants added in a prior session and the `event.stopPropagation()` behavior (this button sits as a sibling inside a stretched-link card and must not trigger card navigation).

- [ ] **Step 2: Replace the implementation**

```tsx
import { Star } from 'lucide-react';
import { useUserDataStore } from '../../store/userDataStore';
import { Toggle } from '@/components/ui/toggle';

interface TopicFavoriteButtonProps {
  topicId: string;
  size?: 'xs' | 'sm' | 'lg';
  tabIndex?: number;
}

const SIZE_CLASS: Record<'xs' | 'sm' | 'lg', string> = {
  xs: 'size-9',
  sm: 'size-11',
  lg: 'size-12',
};

const ICON_SIZE: Record<'xs' | 'sm' | 'lg', number> = {
  xs: 15,
  sm: 18,
  lg: 22,
};

export default function TopicFavoriteButton({ topicId, size = 'sm', tabIndex = 0 }: TopicFavoriteButtonProps) {
  const isFavorite = useUserDataStore((s) => s.favorites.has(topicId));
  const toggleFavorite = useUserDataStore((s) => s.toggleFavorite);

  return (
    <Toggle
      tabIndex={tabIndex}
      pressed={isFavorite}
      onPressedChange={() => toggleFavorite(topicId)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      aria-label={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
      className={`kb-favorite-star grid place-items-center rounded-full border border-[var(--kb-border)] bg-[var(--kb-surface)] data-[state=on]:bg-[var(--kb-surface)] data-[state=on]:text-[var(--kb-accent)] ${SIZE_CLASS[size]}`}
    >
      <Star aria-hidden="true" size={ICON_SIZE[size]} fill={isFavorite ? 'currentColor' : 'none'} />
    </Toggle>
  );
}
```

(Radix `Toggle` renders `aria-pressed` from the `pressed` prop automatically — matches the existing test's `aria-pressed` assertions exactly. `onClick`'s `preventDefault`/`stopPropagation` is kept as a separate handler alongside `onPressedChange`, since Radix calls both: `onClick` fires first for the propagation-stopping side effect, `onPressedChange` fires for the actual state toggle. The `.kb-favorite-star[aria-pressed='true']` CSS rule in `index.css` continues to match unchanged; the added `data-[state=on]:` classes are redundant with it but harmless — remove them in Step 4 if visual testing shows no difference, to avoid dead code.)

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/components/topic/TopicFavoriteButton.test.tsx`
Expected: PASS with no query changes (same `role="button"`, same `aria-pressed`, same `aria-label`).

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

- [ ] **Step 5: Manual check**

On a topic card and in the reader's progress panel, click the favorite star, confirm it toggles and does not navigate the card/link underneath it; confirm the accent-colored pressed state renders in both themes.

- [ ] **Step 6: Commit**

```bash
git add src/components/topic/TopicFavoriteButton.tsx
git commit -m "refactor: migrate TopicFavoriteButton to shadcn Toggle"
```

---

## Task 12: `StatusSegmented` + Settings theme picker → `ToggleGroup`

**Files:**
- Modify: `kb-app/src/components/reader/StatusSegmented.tsx`
- Modify: `kb-app/src/components/reader/StatusSegmented.test.tsx`
- Modify: `kb-app/src/pages/Settings.tsx`
- Modify: `kb-app/src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `ToggleGroup`, `ToggleGroupItem` from `@/components/ui/toggle-group` (Task 3).

Both components are the same "segmented control, pick exactly one" pattern hand-built independently today; per the spec, Radix's `ToggleGroup` in `type="single"` mode renders `role="radiogroup"`/`role="radio"`/`aria-checked` — the same semantics both existing implementations already use, so no accessibility downgrade.

- [ ] **Step 1: Read both current tests first**

Read `kb-app/src/components/reader/StatusSegmented.test.tsx` and the theme-picker section of `kb-app/src/pages/Settings.test.tsx` in full.

- [ ] **Step 2: Replace `StatusSegmented.tsx`**

```tsx
import { ALL_STATUSES, STATUS_LABELS } from '../../lib/progressStatus';
import { useUserDataStore } from '../../store/userDataStore';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface StatusSegmentedProps {
  topicId: string;
}

export default function StatusSegmented({ topicId }: StatusSegmentedProps) {
  const status = useUserDataStore((s) => s.progress.get(topicId) ?? 'new');
  const setStatus = useUserDataStore((s) => s.setStatus);

  return (
    <ToggleGroup
      type="single"
      value={status}
      onValueChange={(value) => value && setStatus(topicId, value as typeof status)}
      aria-label="מצב למידה"
      className="w-full rounded-[10px] bg-[var(--kb-surface2)] p-[3px]"
    >
      {ALL_STATUSES.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className="min-h-11 flex-1 rounded-lg px-2 text-sm data-[state=on]:bg-[var(--kb-surface)] data-[state=on]:font-semibold data-[state=on]:text-[var(--kb-accent)] data-[state=on]:shadow-[var(--kb-shadow-sm)] lg:min-h-9"
        >
          {STATUS_LABELS[option]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
```

(Radix's `onValueChange` for `type="single"` fires with `""` when the currently-selected item is clicked again, since a single-select radio-like group's own item click normally can't deselect — but `ToggleGroupItem`'s default behavior may pass an empty string in some edge cases; the `value &&` guard prevents calling `setStatus` with an empty status. Verify this doesn't block legitimate re-clicks in Step 5's manual check — since `type="single"` without `collapsible` shouldn't allow deselecting the current item in the first place, this guard should never actually trigger, but it costs nothing to keep as a safety net.)

- [ ] **Step 3: Update `StatusSegmented.test.tsx`**

Radix's `ToggleGroupItem` in a `type="single"` group renders `role="radio"` with `aria-checked` (confirmed in Section 3 of the spec) — the existing test's `getByRole('radio', { name: ... })`/`aria-checked` queries should need **no changes**. Run it first before editing to confirm.

- [ ] **Step 4: Replace the theme radiogroup in `Settings.tsx`**

Replace the `<div role="radiogroup" ...><label>...<input type="radio" .../></label></div>` block with:

```tsx
<ToggleGroup
  type="single"
  value={themePreference}
  onValueChange={(value) => value && handleThemeChoice(value as ThemePreference)}
  aria-label="ערכת נושא"
  className="w-fit rounded-[10px] bg-[var(--kb-surface2)] p-[3px]"
>
  {THEME_OPTIONS.map((option) => (
    <ToggleGroupItem
      key={option.value}
      value={option.value}
      className="min-h-10 rounded-lg px-4 text-sm data-[state=on]:bg-[var(--kb-surface)] data-[state=on]:font-semibold data-[state=on]:text-[var(--kb-accent)] data-[state=on]:shadow-[var(--kb-shadow-sm)]"
    >
      {option.label}
    </ToggleGroupItem>
  ))}
</ToggleGroup>
```

Add `import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';` to `Settings.tsx`'s imports. The surrounding `<fieldset>`/`<legend>` stay unchanged.

- [ ] **Step 5: Update `Settings.test.tsx`**

Same as Step 3 — Radix's `role="radio"`/`aria-checked` should match the old `role="radio"` (native `<input type="radio">`) queries with no changes needed. Run first to confirm before editing.

- [ ] **Step 6: Run both tests**

Run: `npx vitest run src/components/reader/StatusSegmented.test.tsx src/pages/Settings.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

- [ ] **Step 8: Manual check**

On a topic page, cycle learning status via click and via keyboard (Tab to the group, arrow keys to move between options — Radix's `radiogroup` role supports roving arrow-key navigation, a slight *improvement* over the old implementation's plain Tab-only navigation between three separate buttons; confirm arrow keys move focus/selection between the three options). Same check on Settings' theme picker, confirming the header `ThemeToggle` and command-palette theme action both still stay in sync with this control (via the existing `kb-theme-change` event listener, unchanged).

- [ ] **Step 9: Commit**

```bash
git add src/components/reader/StatusSegmented.tsx src/components/reader/StatusSegmented.test.tsx src/pages/Settings.tsx src/pages/Settings.test.tsx
git commit -m "refactor: migrate StatusSegmented and Settings theme picker to shadcn ToggleGroup"
```

---

## Task 13: `TopicNotes` → `Textarea` + `Label`

**Files:**
- Modify: `kb-app/src/components/topic/TopicNotes.tsx`
- Modify: `kb-app/src/components/topic/TopicNotes.test.tsx`

**Interfaces:**
- Consumes: `Textarea` from `@/components/ui/textarea`, `Label` from `@/components/ui/label` (Task 3).

This component's save-debounce/hydration-resync state logic (the large comment blocks explaining `editedTextRef`, `prevTopicId`, `hasHydrated`) is untouched — only the rendered `<label>`/`<textarea>` become `Label`/`Textarea`.

- [ ] **Step 1: Read the current test first**

Read `kb-app/src/components/topic/TopicNotes.test.tsx` in full.

- [ ] **Step 2: Replace only the returned JSX**, keeping every hook/handler above it identical:

```tsx
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ...(all existing state/effects/handlers unchanged)...

  return (
    <div className="mt-8 border-t border-[var(--kb-border)] pt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Label htmlFor={`topic-notes-${topicId}`} className="text-sm font-bold text-[var(--kb-text)]">
          ההערות שלי
        </Label>
        {(isDirty || hasSaved) && (
          <span role="status" className="text-xs text-[var(--kb-muted)]">
            {isDirty ? 'שומר…' : 'נשמר'}
          </span>
        )}
      </div>
      <Textarea
        id={`topic-notes-${topicId}`}
        ref={inputRef}
        value={value}
        onChange={(event) => {
          const text = event.target.value;
          setValue(text);
          editedTextRef.current = text;
          setIsDirty(true);
          scheduleSave(text);
        }}
        onBlur={(event) => flush(event.target.value)}
        placeholder="כתוב כאן הערות אישיות על הנושא…"
        rows={4}
        className="w-full"
      />
    </div>
  );
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/components/topic/TopicNotes.test.tsx`
Expected: PASS with no query changes (same `id`/`htmlFor` association, same `role="textbox"` from the underlying native `<textarea>` that shadcn's `Textarea` renders).

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

- [ ] **Step 5: Manual check**

Type a note, confirm the debounced "שומר…"/"נשמר" status still appears, tab away to blur and confirm it flushes immediately.

- [ ] **Step 6: Commit**

```bash
git add src/components/topic/TopicNotes.tsx
git commit -m "refactor: migrate TopicNotes to shadcn Textarea and Label"
```

---

## Task 14: Reader loading skeleton → `Skeleton`

**Files:**
- Modify: `kb-app/src/components/reader/TopicReader.tsx`
- Modify: `kb-app/src/styles/index.css`

**Interfaces:**
- Consumes: `Skeleton` from `@/components/ui/skeleton` (Task 3).

- [ ] **Step 1: Locate the current skeleton markup**

Read the `role="status" aria-busy="true" className="kb-skeleton"` block in `kb-app/src/components/reader/TopicReader.tsx` (rendered while `rawHtml === null` and no error).

- [ ] **Step 2: Replace the 9 hand-styled `<span>` placeholders with `Skeleton`**, keeping the exact same width variety (this reproduces layout, not content, so widths matter for a convincing loading shape):

```tsx
import { Skeleton } from '@/components/ui/skeleton';

// ...inside the loading branch:
<div role="status" aria-busy="true" className="flex flex-col gap-[0.85rem]">
  <span className="sr-only">טוען תוכן…</span>
  <Skeleton className="mb-2 h-5 w-[36%]" />
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-[92%]" />
  <Skeleton className="h-4 w-[85%]" />
  <Skeleton className="h-4 w-[60%]" />
  <Skeleton className="mt-5 h-5 w-[40%]" />
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-[88%]" />
  <Skeleton className="h-4 w-[70%]" />
</div>
```

- [ ] **Step 3: Remove the now-unused `.kb-skeleton` CSS** from `kb-app/src/styles/index.css` (the `.kb-skeleton`, `.kb-skeleton > span`, `.kb-skeleton > span:nth-child(N)` rules, and the `@keyframes kb-skeleton-pulse` block) — `Skeleton`'s own generated component includes its own pulse animation.

- [ ] **Step 4: Verify no other file references `.kb-skeleton`**

Run: `grep -rn "kb-skeleton" src/`
Expected: no matches remain.

- [ ] **Step 5: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

(No dedicated test targets this specific loading-state markup beyond `TopicReader.test.tsx`'s existing coverage, which asserts on `role="status"`/`aria-busy` — confirm those two attributes are still present in Step 2's replacement, since they are what the existing test actually checks, not the specific skeleton shape.)

- [ ] **Step 6: Manual check**

Throttle network in devtools (or use a slow topic-content path) to see the skeleton render before content loads, in both themes; confirm the pulse animation stops under `prefers-reduced-motion: reduce`.

- [ ] **Step 7: Commit**

```bash
git add src/components/reader/TopicReader.tsx src/styles/index.css
git commit -m "refactor: migrate reader loading state to shadcn Skeleton"
```

---

## Task 15: Settings inputs/buttons → `Input`/`Button`; message banner → `Alert`

**Files:**
- Modify: `kb-app/src/pages/Settings.tsx`
- Modify: `kb-app/src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `Input` from `@/components/ui/input`, `Button` from `@/components/ui/button`, `Alert`, `AlertDescription` from `@/components/ui/alert` (Task 3).

- [ ] **Step 1: Read the current test first** (if not already fully internalized from Task 12 — re-check the parts of the test covering export/import/sync/sign-in buttons and the message banner specifically).

- [ ] **Step 2: Replace every `<button className={BUTTON_CLASS}>` with `Button`**

There are 6 such buttons (sign out, sync now, send magic link submit, install app, export, import). Replace each, e.g.:

```tsx
<Button type="button" variant="outline" onClick={handleSignOut}>
  התנתק
</Button>
```

Apply the same pattern (`variant="outline"`, keeping `type`, `onClick`/`disabled`/children exactly as they are) to all 6; drop the now-unused `BUTTON_CLASS` constant once every usage is replaced.

- [ ] **Step 3: Replace the magic-link email `<input>` and the file `<input>`'s visible counterpart is unaffected (it stays `sr-only`, no visual change needed)** — replace the email input:

```tsx
<Input
  id="settings-email"
  type="email"
  required
  autoComplete="email"
  inputMode="email"
  value={emailInput}
  onChange={(e) => setEmailInput(e.target.value)}
  placeholder="you@example.com"
  dir="ltr"
/>
```

(Drop the manual className string — `Input`'s own default styling already uses the `--border`/`--input`/`--ring` tokens from Task 2, which resolve to the same `--kb-border-input`/`--kb-accent` values the old hardcoded className referenced.)

- [ ] **Step 4: Replace the message banner** with `Alert`:

```tsx
import { Alert, AlertDescription } from '@/components/ui/alert';

// ...
{message && (
  <Alert variant={message.kind === 'error' ? 'destructive' : 'default'} role={message.kind === 'error' ? 'alert' : 'status'}>
    <AlertDescription>{message.text}</AlertDescription>
  </Alert>
)}
```

- [ ] **Step 5: Update `Settings.test.tsx`**

Button/input role-based queries (`getByRole('button', { name: ... })`, `getByLabelText('כתובת אימייל')`) should need no changes. The message banner's `role="alert"`/`role="status"` is preserved explicitly in Step 4, so those queries also need no changes. Run first to confirm before editing.

- [ ] **Step 6: Run the test**

Run: `npx vitest run src/pages/Settings.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

- [ ] **Step 8: Manual check**

Trigger both a success message (e.g. successful export) and an error message (e.g. select an invalid import file) and confirm the `Alert`'s destructive-variant styling (using the new `--destructive` token from Task 2) is legible in both themes.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Settings.tsx src/pages/Settings.test.tsx
git commit -m "refactor: migrate Settings buttons/input/message banner to shadcn Button, Input, Alert"
```

---

## Task 16: Reader offline-error state → `Alert`

**Files:**
- Modify: `kb-app/src/components/reader/TopicReader.tsx`

**Interfaces:**
- Consumes: `Alert`, `AlertDescription` from `@/components/ui/alert` (Task 3, already added as a dependency in Task 15).

- [ ] **Step 1: Locate the current error markup**

Find the `<p role="alert">{error.offline ? '...' : '...'}</p>` block in `TopicReader.tsx` (the `error` branch of the content-loading conditional).

- [ ] **Step 2: Replace with `Alert`**

```tsx
<Alert variant="destructive" role="alert">
  <AlertDescription>
    {error.offline
      ? 'אין חיבור לאינטרנט — ניתן לצפות רק בנושאים שנצפו כבר.'
      : 'שגיאה בטעינת התוכן.'}
  </AlertDescription>
</Alert>
```

- [ ] **Step 3: Verify `TopicReader.test.tsx` still passes**

Run: `npx vitest run src/components/reader/TopicReader.test.tsx`
Expected: PASS (the test asserts on `role="alert"` and the message text, both preserved explicitly).

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

- [ ] **Step 5: Manual check**

Go offline (devtools Network → Offline) and navigate to a topic never viewed before; confirm the offline `Alert` renders legibly in both themes.

- [ ] **Step 6: Commit**

```bash
git add src/components/reader/TopicReader.tsx
git commit -m "refactor: migrate reader offline-error state to shadcn Alert"
```

---

## Task 17: Remaining `<button>`/`<select>` sweep — Header, `TopicStatusButton`, Home's bulk actions, `TopicFilters` (shared), Flashcards, Quiz, Map

**Files:**
- Modify: `kb-app/src/components/layout/Header.tsx`
- Modify: `kb-app/src/components/topic/TopicStatusButton.tsx`
- Modify: `kb-app/src/pages/Home.tsx`
- Modify: `kb-app/src/components/browse/TopicFilters.tsx`
- Modify: `kb-app/src/components/browse/TopicFilters.test.tsx`
- Modify: `kb-app/src/pages/Flashcards.tsx`
- Modify: `kb-app/src/pages/Flashcards.test.tsx`
- Modify: `kb-app/src/pages/Quiz.tsx`
- Modify: `kb-app/src/pages/Quiz.test.tsx`
- Modify: `kb-app/src/pages/Map.tsx`
- Modify: `kb-app/src/pages/Map.test.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` from `@/components/ui/select`, `Label` from `@/components/ui/label` (Task 3).

`TopicFilters.tsx` (module/category native `<select>`s) is shared by Flashcards, Quiz, and Map — it was not in the Section 2 mapping table by name, but it is the exact same pattern as `SortMenu` (Task 9), and this sweep found that Flashcards, Quiz, and Map each *also* have their own additional native `<select>`s (status filter, question count, jump-to-topic) styled identically. Leaving these unmigrated while `SortMenu` moves to `Select` would be the one visibly inconsistent corner of the whole redesign, so this task migrates all of them. Flashcards' "רק כרטיסים לחזרה היום" checkbox stays a plain native `<input type="checkbox">` — a single checkbox with no other checkboxes anywhere in the app doesn't justify scaffolding a whole new `Checkbox` primitive for one call site (same "utility-first, extract only for true repetition" reasoning the spec applies to `FilterChips`).

Do this **file by file**, running each file's own test immediately after, rather than editing all of them then testing once.

- [ ] **Step 1: `TopicFilters.tsx`** — replace both native `<select>`s:

```tsx
import type { ModulesMap } from '../../types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      <div className="flex flex-col gap-1 text-sm text-[var(--kb-text)]">
        <Label>מודול</Label>
        <Select value={selectedModule} onValueChange={onModuleChange}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכול</SelectItem>
            {Object.entries(modules).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1 text-sm text-[var(--kb-text)]">
        <Label>קטגוריה</Label>
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכול</SelectItem>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
```

Read `kb-app/src/components/browse/TopicFilters.test.tsx` first, then update it the same way as `SortControls.test.tsx` in Task 9 Step 3 (click the trigger via `getByRole('combobox', { name: ... })`, then click the option).

Run: `npx vitest run src/components/browse/TopicFilters.test.tsx` — fix any broken query, then commit:
```bash
git add src/components/browse/TopicFilters.tsx src/components/browse/TopicFilters.test.tsx
git commit -m "refactor: migrate TopicFilters to shadcn Select"
```

- [ ] **Step 2: `Header.tsx`** — replace the menu button, search button, settings link, and install button (lines given are from the current file read earlier this session):

```tsx
import { Button } from '@/components/ui/button';

// menu button:
<Button
  type="button"
  variant="secondary"
  size="icon"
  onClick={() => setDrawerOpen(true)}
  aria-label="פתח תפריט"
  aria-expanded={drawerOpen}
  className="size-11 rounded-[10px] md:hidden"
>
  <Menu aria-hidden="true" size={20} />
</Button>

// search button:
<Button
  type="button"
  variant="secondary"
  onClick={() => window.dispatchEvent(new Event('kb-open-palette'))}
  aria-label="חיפוש מהיר (Ctrl+K)"
  className="flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm text-[var(--kb-muted)] lg:w-64"
>
  <Search aria-hidden="true" size={18} />
  <span className="hidden min-w-0 flex-1 truncate text-start lg:inline">חפש נושא, הגדרה או הערה…</span>
  <kbd
    aria-hidden="true"
    className="hidden rounded border border-[var(--kb-border)] bg-[var(--kb-surface)] px-1.5 py-0.5 font-mono text-[11px] lg:inline"
  >
    Ctrl K
  </kbd>
</Button>

// settings link (kept as Link via asChild, for real client-side navigation):
<Button variant="secondary" size="icon" asChild className="size-11 rounded-[10px]">
  <Link to="/settings" aria-label="הגדרות" title="הגדרות">
    <SlidersHorizontal aria-hidden="true" size={18} />
  </Link>
</Button>

// install button (unchanged condition: {canInstall && (...)}):
<Button
  type="button"
  variant="outline"
  onClick={promptInstall}
  className="hidden items-center gap-2 rounded-[10px] px-3 text-sm font-semibold sm:flex"
>
  <Download aria-hidden="true" size={16} />
  התקן אפליקציה
</Button>
```

Drop the now-unused `iconButtonClass` constant once every usage above is replaced. Keep the logo `<Link>` untouched (no click handler beyond navigation, not part of this sweep).

Run: `npx vitest run src/components/layout/Header.test.tsx` — fix any broken query, then commit:
```bash
git add src/components/layout/Header.tsx
git commit -m "refactor: migrate Header buttons to shadcn Button"
```

- [ ] **Step 3: `TopicStatusButton.tsx`** — replace the `<button className="kb-status-pill ...">` with `Button` (`variant="outline" size="icon"`, keeping the `kb-status-pill` class alongside for the existing `[data-status]` CSS hooks in `index.css` to keep matching):

```tsx
<Button
  type="button"
  variant="outline"
  size="icon"
  tabIndex={tabIndex}
  onClick={(event) => {
    event.preventDefault();
    event.stopPropagation();
    cycleStatus(topicId);
  }}
  aria-label={`מצב למידה: ${STATUS_LABELS[status]}. לחץ למעבר ל'${STATUS_LABELS[NEXT_STATUS[status]]}'`}
  data-status={status}
  className={`kb-status-pill rounded-full ${size === 'lg' ? 'size-12' : 'size-11'}`}
>
  <Icon aria-hidden="true" size={size === 'lg' ? 22 : 18} />
</Button>
```

Run: `npx vitest run src/components/topic/TopicStatusButton.test.tsx` — fix any broken query, then commit:
```bash
git add src/components/topic/TopicStatusButton.tsx
git commit -m "refactor: migrate TopicStatusButton to shadcn Button"
```

- [ ] **Step 4: `Home.tsx`** — replace the "הרחב הכול"/"כווץ הכול" bulk-action buttons and the "נקה סינון והצג הכול" empty-state button:

```tsx
<Button type="button" variant="link" onClick={expandAllGroups} className="h-auto min-h-10 p-0 px-1 font-medium">
  הרחב הכול
</Button>
<Button type="button" variant="link" onClick={collapseAllGroups} className="h-auto min-h-10 p-0 px-1 font-medium">
  כווץ הכול
</Button>
{/* ...inside the empty-state block: */}
<Button type="button" onClick={clearFilters} className="mt-1 rounded-[10px]">
  נקה סינון והצג הכול
</Button>
```

Run: `npx vitest run src/pages/Home.test.tsx` — fix any broken query (this also re-confirms Task 8's expand/collapse-all behavior still passes), then commit:
```bash
git add src/pages/Home.tsx
git commit -m "refactor: migrate Home's bulk-action buttons to shadcn Button"
```

- [ ] **Step 5: `Flashcards.tsx`** — replace the status `<select>` with `Select`, and the four plain `<button>`s (practice-all-cards, restart-session, reveal, and the four rating buttons) with `Button`. Read `kb-app/src/pages/Flashcards.tsx` in full before editing (already read during plan-writing — the relevant blocks are the `PRIMARY_BUTTON`/`SECONDARY_BUTTON` constants and every element using them):

```tsx
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// status select:
<div className="flex flex-col gap-1 text-sm text-[var(--kb-text)]">
  <Label>מצב למידה</Label>
  <Select value={selectedStatus} onValueChange={(value) => handleStatusChange(value as ProgressStatus | 'all')}>
    <SelectTrigger className="min-h-11">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">הכול</SelectItem>
      {ALL_STATUSES.map((status) => (
        <SelectItem key={status} value={status}>
          {STATUS_LABELS[status]}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

// "תרגל את כל הכרטיסים":
<Button type="button" onClick={() => handleDueOnlyChange(false)} className="mt-1">
  תרגל את כל הכרטיסים
</Button>

// "סבב נוסף":
<Button type="button" onClick={() => resetSession(buildQueue(selectedModule, selectedCategory, selectedStatus, dueOnly))}>
  סבב נוסף
</Button>

// reveal button (keep the existing ref):
<Button ref={revealButtonRef} type="button" onClick={() => setRevealed(true)}>
  לחץ לחשיפה
</Button>

// rating buttons (keep the existing map, only the element changes):
{RATINGS.map(({ rating, label, key }) => (
  <Button
    key={rating}
    type="button"
    variant={rating === 'good' ? 'default' : 'outline'}
    onClick={() => handleRate(rating)}
    className="flex items-center justify-center gap-2"
  >
    {label}
    <kbd
      aria-hidden="true"
      className="hidden rounded border border-current/30 px-1 font-mono text-[11px] font-normal opacity-70 sm:inline"
    >
      {key}
    </kbd>
  </Button>
))}
```

Drop the now-unused `PRIMARY_BUTTON`/`SECONDARY_BUTTON` constants once every usage is replaced. Add `import { Label } from '@/components/ui/label';` alongside the other new imports.

Read `kb-app/src/pages/Flashcards.test.tsx` first, then update its status-select query the same way as Task 9 Step 3.

Run: `npx vitest run src/pages/Flashcards.test.tsx` — fix any remaining broken query, then commit:
```bash
git add src/pages/Flashcards.tsx src/pages/Flashcards.test.tsx
git commit -m "refactor: migrate Flashcards status select and buttons to shadcn Select/Button"
```

- [ ] **Step 6: `Quiz.tsx`** — replace the status `<select>` and question-count `<select>` with `Select`, and the start/new-quiz/answer/next `<button>`s with `Button` (the per-option answer buttons keep their existing `disabled`/`aria-pressed`/`stateClass` logic, only the base element changes):

```tsx
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// status select:
<div className="flex flex-col gap-1 text-sm text-[var(--kb-text)]">
  <Label>מצב למידה</Label>
  <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as ProgressStatus | 'all')}>
    <SelectTrigger className="min-h-11">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">הכול</SelectItem>
      {ALL_STATUSES.map((status) => (
        <SelectItem key={status} value={status}>
          {STATUS_LABELS[status]}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

// question-count select:
<div className="flex flex-col gap-1 text-sm text-[var(--kb-text)]">
  <Label>מספר שאלות</Label>
  <Select value={String(questionCount)} onValueChange={(value) => setQuestionCount(value === 'all' ? 'all' : Number(value))}>
    <SelectTrigger className="min-h-11">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {QUESTION_COUNT_OPTIONS.map((n) => (
        <SelectItem key={n} value={String(n)}>
          {n}
        </SelectItem>
      ))}
      <SelectItem value="all">{`הכול (${pool.length})`}</SelectItem>
    </SelectContent>
  </Select>
</div>

// start button:
<Button type="button" onClick={handleStart} disabled={pool.length === 0}>
  התחל מבחן
</Button>

// new-quiz button:
<Button type="button" onClick={() => setQuestions(null)} className="mb-4">
  מבחן חדש
</Button>

// answer option buttons (keep the existing map and stateClass computation):
<Button
  key={option}
  ref={index === 0 ? firstOptionRef : undefined}
  type="button"
  variant="outline"
  disabled={isAnswered}
  onClick={() => handleAnswer(index)}
  aria-pressed={isChosen}
  className={`flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-start disabled:opacity-100 ${stateClass}`}
>
  <span className="min-w-0 flex-1">{option}</span>
  {isAnswered && isCorrectOption && <Check aria-hidden="true" size={18} className="shrink-0 text-[var(--kb-accent)]" />}
  {isAnswered && isChosen && !isCorrectOption && <X aria-hidden="true" size={18} className="shrink-0 text-[var(--kb-muted)]" />}
</Button>

// next button:
<Button type="button" onClick={handleNext} className="mt-4">
  הבא
</Button>
```

Read `kb-app/src/pages/Quiz.test.tsx` first, then update both select queries the same way as Task 9 Step 3.

Run: `npx vitest run src/pages/Quiz.test.tsx` — fix any remaining broken query, then commit:
```bash
git add src/pages/Quiz.tsx src/pages/Quiz.test.tsx
git commit -m "refactor: migrate Quiz selects and buttons to shadcn Select/Button"
```

- [ ] **Step 7: `Map.tsx`** — replace only the jump-to-topic `<select>` with `Select` (confirmed by reading the file during plan-writing: `Map.tsx` has no plain `<button>` elements — only this one inline select plus `TopicFilters`, already covered in Step 1):

```tsx
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

<div className="flex flex-col gap-1 text-sm text-[var(--kb-text)]">
  <Label>קפוץ לנושא</Label>
  <Select
    value=""
    onValueChange={(value) => {
      if (value) navigate(`/topic/${encodeURIComponent(value)}`);
    }}
  >
    <SelectTrigger className="min-h-11 max-w-64">
      <SelectValue placeholder="בחר נושא מהמפה…" />
    </SelectTrigger>
    <SelectContent>
      {graphData.nodes.map((node) => (
        <SelectItem key={node.id} value={node.id}>
          {node.title}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

(Radix `Select` doesn't naturally support an "always empty, fire-and-reset" value the way the old native `<select value="">` did — since `value=""` combined with never calling `setState` for it means the trigger will keep showing the placeholder after each selection, which matches the old behavior exactly: the old code never updated any state either, it read `e.target.value` once per change and immediately navigated. Confirm this behavior manually in Step 9.)

Read `kb-app/src/pages/Map.test.tsx` first, then update its select query the same way as Task 9 Step 3.

Run: `npx vitest run src/pages/Map.test.tsx` — fix any remaining broken query, then commit:
```bash
git add src/pages/Map.tsx src/pages/Map.test.tsx
git commit -m "refactor: migrate Map's jump-to-topic select to shadcn Select"
```

- [ ] **Step 8: Full-repo verification after the whole sweep**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all green — this is the first point where every file touched across Steps 1–7 is checked together.

- [ ] **Step 9: Manual check**

Click through Header (menu, search, install-prompt if available), a topic's status-cycle button, Home's expand/collapse-all and clear-filters, `TopicFilters` on all three pages that use it, a full Flashcards review session (including the status filter and due-only checkbox), a full Quiz attempt (including both selects), and Map's jump-to-topic select (confirm it always resets to the placeholder after navigating, matching the old native-select behavior) — in both themes, confirming nothing lost its click handler or visible label.

---

## Task 18: Final full-suite verification and manual sign-off

**Files:** none (verification only).

- [ ] **Step 1: Full automated verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all four green, with the full test count reported (compare against the pre-migration baseline — 47+ tests were passing in the four suites touched by the very first session in this conversation; the count should now be equal or higher, never lower, since no test was deleted, only updated).

- [ ] **Step 2: Manual pass — light theme**

`npm run dev`. Visit Home, a topic in Reader, Flashcards, Quiz, Map, Settings. Confirm every migrated control (Sheet drawer, Dialog shortcuts help, Command palette, Select sort menu, ToggleGroup status/theme pickers, Toggle favorite star, Accordion module groups, Card-wrapped topic cards/dashboard tiles, Alert error/message states, Skeleton loading state) renders correctly and matches the pre-migration visual identity.

- [ ] **Step 3: Manual pass — dark theme**

Toggle to dark (via `ThemeToggle`, Settings, or the command palette action) and repeat Step 2's full page walkthrough.

- [ ] **Step 4: Manual pass — RTL correctness**

Confirm (still in either theme): the `Sheet` drawer slides in from the right; `Select`/`Command`/`ToggleGroup` popper/focus content is not mirrored incorrectly; `AccordionTrigger`'s chevron and the sidebar's own logical-property layout (from the earlier sidebar-position fix this session) are unaffected by this migration.

- [ ] **Step 5: Manual pass — keyboard-only navigation**

Using only Tab/Shift+Tab/Enter/Space/Arrow keys/Escape: open and close the mobile drawer, shortcuts dialog, and command palette; operate the sort select, both toggle groups, the favorite toggle, and at least one accordion group — confirm focus is always visible (the global `:focus-visible` ring) and never trapped incorrectly.

- [ ] **Step 6: Confirm `.kb-topic-content` is unaffected**

Open a topic with formulas, tables, and code blocks; confirm rendering is pixel-identical to before this migration (per Global Constraints, no task in this plan touches this CSS or the raw HTML it styles).

- [ ] **Step 7: Push**

```bash
git push
```

- [ ] **Step 8: Update `kb-app/CLAUDE.md` if warranted**

Read `kb-app/CLAUDE.md`'s "מבנה" (structure) section — if it doesn't already mention `src/components/ui/` as the shadcn/ui primitives directory, add one line noting it, consistent with the file's existing terse per-directory documentation style. Commit separately if changed:

```bash
git add kb-app/CLAUDE.md
git commit -m "docs: note src/components/ui/ (shadcn/ui primitives) in project structure"
git push
```
