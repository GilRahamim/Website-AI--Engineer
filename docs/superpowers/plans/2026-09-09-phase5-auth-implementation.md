# Phase 5, Sub-project #2 — Supabase Project + Magic-Link Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user optionally sign in with a Supabase magic-link email from the Settings page, with a new `authStore` tracking session state, and zero change to signed-out behavior — no DB schema, RLS, or data sync (that's sub-project #3).

**Architecture:** A singleton Supabase client (`lib/supabase.ts`) backs a new Zustand `authStore` (`email`/`status`/`errorMessage` + `init`/`sendMagicLink`/`signOut`), initialized once from `App.tsx`'s existing mount effect. `Settings.tsx` gets a new "חשבון" (Account) section above Export/Import, reusing its existing local `message` state for feedback.

**Tech Stack:** React 19, TypeScript, Zustand, `@supabase/supabase-js` (new dependency), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-09-phase5-auth-design.md`

## Global Constraints

- No `supabase/schema.sql`, RLS policies, or any data push/pull to Supabase tables in this sub-project — that's sub-project #3.
- Sign-out (`authStore.signOut()`) only ends the Supabase session — it must never touch IndexedDB or any `userDataStore` state.
- No raw Supabase error text is ever shown to the user — `sendMagicLink` failures always produce a fixed, generic Hebrew message.
- No hardcoded colors — only `--kb-*` tokens. Every interactive element ≥44px tall (`min-h-11`) with visible `focus-visible`.
- **No live Supabase project exists yet, and none is needed for this plan.** `createClient()` throws synchronously on construction if given an invalid URL, so a `kb-app/.env.test` file with syntactically valid (but fake) placeholder values is added in Task 1 — Vite/Vitest load `.env.test` automatically in test mode, with no `vitest.config.ts` change needed. This keeps `npm run test`/`typecheck`/`lint`/`build` fully green with no real project; a real project (and real `.env` values) is only needed for your own manual end-to-end check after all tasks are done.

---

## Task 1: Supabase client + test/example env files

**Files:**
- Modify: `kb-app/package.json`, `kb-app/package-lock.json` (new dependency)
- Create: `kb-app/src/lib/supabase.ts`
- Create: `kb-app/.env.example`
- Create: `kb-app/.env.test`

**Interfaces:**
- Produces: `supabase` — a singleton Supabase client instance, exported from `kb-app/src/lib/supabase.ts`. Consumed by `authStore.ts` in Task 2.

This task has no dedicated unit test — `lib/supabase.ts` is a one-line client construction with no logic of its own, and its only consumer (`authStore.ts`, Task 2) replaces this whole module with a mock in its tests, so there is nothing here to assert beyond "it compiles and doesn't throw," which the steps below verify directly.

- [ ] **Step 1: Install the dependency**

Run: `cd kb-app && npm install @supabase/supabase-js`

- [ ] **Step 2: Create `lib/supabase.ts`**

Create `kb-app/src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

// The anon key is safe to expose client-side — Row-Level Security (added in
// Phase 5 sub-project #3) is the actual security boundary, not key secrecy.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

- [ ] **Step 3: Create `.env.example`**

Create `kb-app/.env.example`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 4: Create `.env.test`**

Create `kb-app/.env.test` — committed to git (unlike `.env`/`.env.local`, which stay gitignored per the repo's root `.gitignore`): syntactically valid placeholder values so `createClient()` never throws during `npm run test`, across every test file that imports `lib/supabase.ts` transitively, not just this sub-project's own new tests:

```
VITE_SUPABASE_URL=https://example.supabase.co
VITE_SUPABASE_ANON_KEY=test-anon-key
```

- [ ] **Step 5: Verify**

Run: `cd kb-app && npm run typecheck && npm run lint && npm run build`
Expected: all three green. (`npm run test` is not run yet as a meaningful check here — nothing imports `lib/supabase.ts` until Task 2, so there's nothing new for the suite to exercise.)

- [ ] **Step 6: Commit**

```bash
git add kb-app/package.json kb-app/package-lock.json kb-app/src/lib/supabase.ts kb-app/.env.example kb-app/.env.test
git commit -m "feat: add Supabase client and test/example env files"
```

---

## Task 2: `authStore.ts`

**Files:**
- Create: `kb-app/src/store/authStore.ts`
- Create: `kb-app/src/store/authStore.test.ts`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase` (Task 1).
- Produces: `useAuthStore` — a Zustand store hook, exported from `kb-app/src/store/authStore.ts`, with state `{ email: string | null; status: 'idle' | 'sending' | 'sent' | 'error'; errorMessage: string | null }` and actions `init(): void`, `sendMagicLink(email: string): Promise<void>`, `signOut(): Promise<void>`. Consumed by `Settings.tsx` (Task 3) and `App.tsx` (Task 4).

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/store/authStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockSignOut = vi.fn();

// Full module replacement (not vi.spyOn on the real client) — this test file
// never needs a real, network-capable Supabase client, so there's no reason
// to depend on .env.test's placeholder values resolving to anything.
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

const { useAuthStore } = await import('./authStore');

beforeEach(() => {
  mockGetSession.mockReset().mockResolvedValue({ data: { session: null } });
  mockOnAuthStateChange.mockReset();
  mockSignInWithOtp.mockReset().mockResolvedValue({ error: null });
  mockSignOut.mockReset().mockResolvedValue({ error: null });
  useAuthStore.setState({ email: null, status: 'idle', errorMessage: null });
});

describe('authStore', () => {
  it('init() sets email from an existing session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { email: 'a@b.com' } } } });
    useAuthStore.getState().init();
    await waitFor(() => expect(useAuthStore.getState().email).toBe('a@b.com'));
  });

  it('init() has no session -> email stays null', async () => {
    useAuthStore.getState().init();
    await waitFor(() => expect(mockGetSession).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().email).toBeNull();
  });

  it('init() subscribes once and updates email when the auth state changes later', () => {
    useAuthStore.getState().init();
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    const callback = mockOnAuthStateChange.mock.calls[0][0];
    callback('SIGNED_IN', { user: { email: 'c@d.com' } });
    expect(useAuthStore.getState().email).toBe('c@d.com');
  });

  it('init() clears email when the auth state changes to signed out', () => {
    useAuthStore.setState({ email: 'x@y.com' });
    useAuthStore.getState().init();
    const callback = mockOnAuthStateChange.mock.calls[0][0];
    callback('SIGNED_OUT', null);
    expect(useAuthStore.getState().email).toBeNull();
  });

  it('sendMagicLink sets status to sending immediately, then sent on success', async () => {
    const promise = useAuthStore.getState().sendMagicLink('a@b.com');
    expect(useAuthStore.getState().status).toBe('sending');
    await promise;
    expect(useAuthStore.getState().status).toBe('sent');
    expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'a@b.com' });
  });

  it('sendMagicLink sets status to error with a fixed generic message on failure, never the raw error', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { message: 'some raw supabase error detail' } });
    await useAuthStore.getState().sendMagicLink('a@b.com');
    expect(useAuthStore.getState().status).toBe('error');
    expect(useAuthStore.getState().errorMessage).toBe('שליחת הקישור נכשלה. נסה שוב.');
    expect(useAuthStore.getState().errorMessage).not.toContain('some raw supabase error detail');
  });

  it('signOut calls supabase.auth.signOut', async () => {
    await useAuthStore.getState().signOut();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd kb-app && npm run test -- authStore.test.ts`
Expected: FAIL — `./authStore` doesn't exist yet.

- [ ] **Step 3: Implement `authStore.ts`**

Create `kb-app/src/store/authStore.ts`:

```ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  email: string | null;
  status: 'idle' | 'sending' | 'sent' | 'error';
  errorMessage: string | null;

  init: () => void;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  email: null,
  status: 'idle',
  errorMessage: null,

  // Synchronous: only sets up the subscription and kicks off an initial read.
  // Called once from App.tsx's existing mount effect (Task 4) — no separate
  // effect needed. The onAuthStateChange subscription is also what picks up
  // a completed magic-link sign-in: Supabase's client auto-detects the
  // session from the URL when the user lands back on the app after clicking
  // the email link, firing this same callback.
  init: () => {
    void supabase.auth.getSession().then(({ data }) => {
      set({ email: data.session?.user.email ?? null });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ email: session?.user.email ?? null });
    });
  },

  sendMagicLink: async (email) => {
    set({ status: 'sending', errorMessage: null });
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      // Fixed, generic message — never the raw Supabase error (Global
      // Constraints), matching Settings.tsx's existing "קובץ לא תקין" pattern.
      set({ status: 'error', errorMessage: 'שליחת הקישור נכשלה. נסה שוב.' });
    } else {
      set({ status: 'sent' });
    }
  },

  // email is cleared by the onAuthStateChange subscription from init(), not
  // set directly here — one source of truth for session state.
  signOut: async () => {
    await supabase.auth.signOut();
  },
}));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd kb-app && npm run test -- authStore.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Run full verification**

Run: `cd kb-app && npm run test && npm run typecheck && npm run lint`
Expected: all three green, same total test count as before this task plus these 7 new tests (this task only touches new files, `.env.test` from Task 1 is not needed here since `lib/supabase.ts` is fully mocked).

- [ ] **Step 6: Commit**

```bash
git add kb-app/src/store/authStore.ts kb-app/src/store/authStore.test.ts
git commit -m "feat: add authStore for Supabase magic-link session state"
```

---

## Task 3: Settings page — Account section

**Files:**
- Modify: `kb-app/src/pages/Settings.tsx`
- Modify: `kb-app/src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore` from `../store/authStore` (Task 2).

This is the task where `.env.test` (Task 1) first matters: `Settings.tsx` will import `authStore.ts`, which imports `lib/supabase.ts` — that import chain now runs in every `Settings.test.tsx` test (not just the new ones below), so `.env.test`'s placeholder values are what let `createClient()` construct without throwing. None of `Settings.test.tsx`'s existing Export/Import tests call `authStore`'s `init()` (only `App.tsx`, Task 4, does that), so they're unaffected beyond this import-time construction.

- [ ] **Step 1: Write the failing tests**

In `kb-app/src/pages/Settings.test.tsx`, add `act` to the existing `@testing-library/react` import (`import { act, render, screen, waitFor } from '@testing-library/react';`) and add `import { useAuthStore } from '../store/authStore';` to the top imports. Add a `beforeEach` reset for it alongside the existing `useUserDataStore.setState(...)` reset:

```tsx
  useAuthStore.setState({ email: null, status: 'idle', errorMessage: null });
```

Then add a new `describe` block, after `describe('Settings — export', ...)` and before `describe('Settings — import', ...)`:

```tsx
describe('Settings — account', () => {
  it('renders the signed-out email form', () => {
    renderSettings();
    expect(screen.getByLabelText('כתובת אימייל')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'שלח קישור התחברות' })).toBeInTheDocument();
  });

  it('submitting the form calls sendMagicLink with the entered email', async () => {
    const user = userEvent.setup();
    const sendMagicLinkSpy = vi.spyOn(useAuthStore.getState(), 'sendMagicLink').mockImplementation(async () => {
      useAuthStore.setState({ status: 'sent' });
    });
    renderSettings();

    await user.type(screen.getByLabelText('כתובת אימייל'), 'a@b.com');
    await user.click(screen.getByRole('button', { name: 'שלח קישור התחברות' }));

    expect(sendMagicLinkSpy).toHaveBeenCalledWith('a@b.com');
    expect(await screen.findByRole('status')).toHaveTextContent('קישור נשלח ל-a@b.com');
  });

  it('disables the submit button while sending, and re-enables after', async () => {
    const user = userEvent.setup();
    let resolveSend: () => void = () => {};
    vi.spyOn(useAuthStore.getState(), 'sendMagicLink').mockImplementation(() => {
      useAuthStore.setState({ status: 'sending' });
      return new Promise((resolve) => {
        resolveSend = () => {
          useAuthStore.setState({ status: 'sent' });
          resolve();
        };
      });
    });
    renderSettings();

    await user.type(screen.getByLabelText('כתובת אימייל'), 'a@b.com');
    const submitButton = screen.getByRole('button', { name: 'שלח קישור התחברות' });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    act(() => resolveSend());
    await waitFor(() => expect(submitButton).not.toBeDisabled());
  });

  it('shows an error message when sendMagicLink fails, form stays visible', async () => {
    const user = userEvent.setup();
    vi.spyOn(useAuthStore.getState(), 'sendMagicLink').mockImplementation(async () => {
      useAuthStore.setState({ status: 'error', errorMessage: 'שליחת הקישור נכשלה. נסה שוב.' });
    });
    renderSettings();

    await user.type(screen.getByLabelText('כתובת אימייל'), 'a@b.com');
    await user.click(screen.getByRole('button', { name: 'שלח קישור התחברות' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('שליחת הקישור נכשלה');
    expect(screen.getByLabelText('כתובת אימייל')).toBeInTheDocument();
  });

  it('shows the signed-in view with the user\'s email when signed in', () => {
    useAuthStore.setState({ email: 'signed-in@example.com' });
    renderSettings();

    expect(screen.getByText('מחובר כ: signed-in@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התנתק' })).toBeInTheDocument();
    expect(screen.queryByLabelText('כתובת אימייל')).not.toBeInTheDocument();
  });

  it('clicking sign out calls authStore.signOut', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ email: 'signed-in@example.com' });
    const signOutSpy = vi.spyOn(useAuthStore.getState(), 'signOut').mockResolvedValue(undefined);
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'התנתק' }));

    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd kb-app && npm run test -- Settings.test.tsx`
Expected: FAIL — no Account section exists yet, `useAuthStore` import in the test file resolves fine (Task 2 already created it) but nothing in `Settings.tsx` reads it yet.

- [ ] **Step 3: Add the Account section to `Settings.tsx`**

Add `import { type FormEvent, useRef, useState, type ChangeEvent } from 'react';` — merge with the existing React import (add `FormEvent` to the existing named imports). Add `import { useAuthStore } from '../store/authStore';` alongside the existing imports.

Inside `export default function Settings()`, add above the existing `const [message, setMessage] = useState...` line:

```tsx
  const email = useAuthStore((s) => s.email);
  const isSending = useAuthStore((s) => s.status === 'sending');
  const [emailInput, setEmailInput] = useState('');
```

Add this handler alongside the existing `handleExport`/`handleImportClick`/`handleFileSelected` functions:

```tsx
  async function handleSendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await useAuthStore.getState().sendMagicLink(emailInput);
    const { status, errorMessage } = useAuthStore.getState();
    if (status === 'sent') {
      setMessage({ kind: 'success', text: `קישור נשלח ל-${emailInput}, בדוק את תיבת הדואר.` });
    } else if (status === 'error') {
      setMessage({ kind: 'error', text: errorMessage ?? 'שליחת הקישור נכשלה.' });
    }
  }

  async function handleSignOut() {
    await useAuthStore.getState().signOut();
  }
```

**Relocate the shared `message` element:** today it's rendered only inside the Import section's JSX (`{message && (<p role={...}>...</p>)}`, currently the last thing inside the "ייבוא נתונים" `<section>`). Since Account/Export/Import all now share this one `message` state, move that exact `{message && (...)}` block out of the Import section and place it directly after the `<h1>הגדרות</h1>` line, before any `<section>` — a single page-level status/alert banner, visible in a consistent spot regardless of which of the three actions produced it. Delete it from its old spot inside Import; do not duplicate it.

Add this new section as the **first** `<section>` inside `<main>`, right after the relocated `message` block, before the existing "ייצוא נתונים" section:

```tsx
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-[var(--kb-text)]">חשבון</h2>
          {email ? (
            <>
              <p className="text-sm text-[var(--kb-text)]">{`מחובר כ: ${email}`}</p>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-11 w-fit rounded-md border border-[var(--kb-border)] px-4 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
              >
                התנתק
              </button>
            </>
          ) : (
            <form onSubmit={handleSendMagicLink} className="flex flex-col gap-2">
              <p className="text-sm text-[var(--kb-muted)]">התחבר כדי לסנכרן נתונים בין מכשירים (בקרוב).</p>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface)] px-3">
                <span className="sr-only">כתובת אימייל</span>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent py-2 text-[var(--kb-text)] outline-none placeholder:text-[var(--kb-muted)]"
                />
              </label>
              <button
                type="submit"
                disabled={isSending}
                className="min-h-11 w-fit rounded-md border border-[var(--kb-border)] px-4 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] disabled:opacity-50"
              >
                שלח קישור התחברות
              </button>
            </form>
          )}
        </section>
```

Note: the `getByLabelText('כתובת אימייל')` query in the tests matches the `<span className="sr-only">` inside the `<label>` wrapping the `<input>` — this is the same accessible-name pattern `SearchBar.tsx` already uses (a `sr-only` span inside a `<label>`, not an `aria-label` attribute), so no `aria-label` prop is needed on the `<input>` itself.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd kb-app && npm run test -- Settings.test.tsx`
Expected: PASS (all tests, including the 6 new ones and all pre-existing Export/Import tests unaffected).

- [ ] **Step 5: Run full verification**

Run: `cd kb-app && npm run test && npm run typecheck && npm run lint`
Expected: all three green.

- [ ] **Step 6: Commit**

```bash
git add kb-app/src/pages/Settings.tsx kb-app/src/pages/Settings.test.tsx
git commit -m "feat: add Account (sign-in/out) section to Settings page"
```

---

## Task 4: Wire `authStore.init()` into `App.tsx`

**Files:**
- Modify: `kb-app/src/App.tsx`
- Modify: `kb-app/src/App.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore` from `./store/authStore` (Task 2).

- [ ] **Step 1: Write the failing test**

In `kb-app/src/App.test.tsx`, add `import { useAuthStore } from './store/authStore';` to the top imports.

Add a module-level `let` above the `describe` block, so both `beforeEach` and the new test share the same spy instance instead of each creating their own (this file has no existing `vi.restoreAllMocks()`/spy-clearing between tests, so two independent `vi.spyOn(...)` calls on the same method would share one accumulating call count instead of each starting fresh):

```tsx
let initSpy: ReturnType<typeof vi.spyOn>;
```

In the existing top-level `beforeEach`, add these two lines as its first two statements, before the existing `global.fetch = ...` line (restore first, so this test file's own spy stays isolated from any spy a previous test left behind, then create a fresh spy this test's assertions can rely on starting at 0 calls — every existing test in the file stays deterministic and network-free this way, since `init()`'s own behavior is already fully covered by `authStore.test.ts`, Task 2, so there's nothing lost by not exercising the real thing here):

```tsx
  vi.restoreAllMocks();
  initSpy = vi.spyOn(useAuthStore.getState(), 'init').mockImplementation(() => {});
```

Add a new test, after the `'renders the Settings page at "/settings"'` test (or after whichever is currently last before `RouteErrorBoundary`'s own test):

```tsx
  it('calls authStore.init() once on mount', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(initSpy).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd kb-app && npm run test -- App.test.tsx`
Expected: FAIL — `App.tsx` never calls `useAuthStore.getState().init()` yet, so the spy is never invoked.

- [ ] **Step 3: Wire `init()` into `App.tsx`'s mount effect**

Add `import { useAuthStore } from './store/authStore';` to `App.tsx`'s imports.

Change the existing mount effect from:

```tsx
  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
  }, []);
```

to:

```tsx
  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
    useAuthStore.getState().init();
  }, []);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd kb-app && npm run test -- App.test.tsx`
Expected: PASS (all tests, including the new one).

- [ ] **Step 5: Run full verification and check the build**

Run: `cd kb-app && npm run test && npm run typecheck && npm run lint && npm run build`
Expected: all four green, same total test count as before this task plus this task's one new test.

- [ ] **Step 6: Commit**

```bash
git add kb-app/src/App.tsx kb-app/src/App.test.tsx
git commit -m "feat: initialize authStore on App mount"
```

---

## Manual QA (post-implementation, not testable in jsdom — requires a real Supabase project)

- Create a Supabase project at supabase.com if you haven't already. In its dashboard, confirm Auth → Providers → Email is enabled with "Confirm email"/magic link defaults (no code change needed for this — it's the project's default Auth config).
- Copy the project's URL and anon key into `kb-app/.env` (create it from `.env.example` — never commit it).
- In the Supabase dashboard, go to Authentication → URL Configuration and add every origin you'll test from (e.g. `http://localhost:5173` for `npm run dev`, plus your eventual production origin) to "Redirect URLs" — `sendMagicLink` passes `emailRedirectTo: window.location.origin`, so the magic link only redirects back to the app from an origin Supabase has been told to trust.
- `npm run dev`, open `/settings`, enter your real email in the Account section, submit. Confirm the "sent" message appears.
- Check your email for the magic link. Click it — confirm it redirects back to the app and the Account section now shows "מחובר כ: `<your email>`".
- Reload the page — confirm you're still shown as signed in (session persists).
- Click "התנתק" — confirm the Account section reverts to the sign-in form, and separately confirm all your local progress/notes/favorites/SRS data (check Home, Flashcards, Reader) is completely untouched.
- Try submitting an obviously malformed email (browser-native validation should block submission before any network call).
- Light theme, dark theme, RTL check on the new Account section in all three states (signed-out form, sent message, signed-in).
- Keyboard-only pass: reach the email field and both buttons via Tab, submit via Enter, confirm visible focus rings throughout.
- Confirm no regression to Export/Import on the same page, or to any other Phase 3/4/5 feature.
