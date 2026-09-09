# Phase 5, Sub-project #2 — Supabase Project + Magic-Link Auth: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** nothing functionally — this sub-project is what sub-project #3 (schema + sync engine) will depend on for a `user_id`. Sub-project #1 (Export/Import Backup) is complete, merged, pushed to `origin/master`, but unrelated to this one (no shared code).
**Scope boundary:** the second of Phase 5's sub-projects ("Phase 5 — בקאנד + סנכרון", `site-build-docs/00-BUILD-README.md`, `04-BACKEND-SUPABASE-SYNC.md`'s "Auth" section). Deliberately scoped to auth alone — no DB schema, no RLS, no data sync. Sub-project #3 covers `supabase/schema.sql`, RLS policies, and the `push/pull/fullSync` engine described in `04-BACKEND-SUPABASE-SYNC.md`'s "אסטרטגיית סנכרון" section.

## Goal

Let a user optionally sign in with a magic-link email via Supabase Auth, entirely from the existing Settings page, with no change to how the app behaves signed out (still fully local, per golden rule 3 in `kb-app/CLAUDE.md`).

## Out of scope

`supabase/schema.sql`, RLS policies, and any of the four sync-engine functions (`pushDirty`/`pullSince`/`fullSync`/`startAutoSync`) from `04-BACKEND-SUPABASE-SYNC.md` — all sub-project #3. Google OAuth (the doc explicitly defers it: "אפשר להוסיף Google OAuth בהמשך"). Any actual read/write of `progress`/`notes`/`favorites`/`srsCards` to Supabase — signing in only authenticates; it moves no data. Clearing IndexedDB on sign-out (decided during brainstorming — sign-out only ends the Supabase session, local data is never touched, since the app must keep working fully local-first regardless of auth state).

## Section 1: Supabase client

New file `kb-app/src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

New dependency: `@supabase/supabase-js`. New env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, documented with placeholders in a new `kb-app/.env.example` (`.env` itself is already gitignored — confirmed present in `kb-app/.gitignore`). The anon key is safe to expose client-side per Supabase's own model — RLS (sub-project #3) is the actual security boundary, not key secrecy.

No live Supabase project exists yet. **Correction from the whole-branch review:** `createClient()` DOES validate its URL synchronously and throws on a missing/empty value — the original claim above was wrong. `lib/supabase.ts` therefore exports a lazy, memoized `getSupabase(): SupabaseClient | null` instead of an eagerly-constructed client, returning `null` (never throwing) when either env var is absent, so the app boots correctly with no `.env` at all (golden rule 3). Every consumer (`authStore.ts`) guards on a `null` return. Every test in this sub-project mocks `lib/supabase.ts` rather than hitting a real project — so implementation and its automated tests need no live project. A live project is needed only for your own manual end-to-end check after implementation (creating one, and filling in `.env`, happens at that point).

## Section 2: `authStore.ts`

New file `kb-app/src/store/authStore.ts`, a Zustand store following the same shape as `uiStore.ts`/`userDataStore.ts`:

```ts
interface AuthState {
  email: string | null;
  status: 'idle' | 'sending' | 'sent' | 'error';
  errorMessage: string | null;

  init: () => void;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

- `email`: the signed-in user's email, or `null` when signed out. This is the store's source of truth for "is the user signed in" — no separate boolean.
- `init()`: called once, from `App.tsx`'s existing mount `useEffect` (alongside the current `loadUserData()` call — not a new effect). Subscribes to `supabase.auth.onAuthStateChange((_event, session) => set({ email: session?.user.email ?? null }))` and also reads the current session once via `supabase.auth.getSession()` to set initial state before the first auth event fires. This is also the mechanism that picks up a completed magic-link sign-in: Supabase's JS SDK auto-detects the session from the URL when the user lands back on the app after clicking the email link (`detectSessionInUrl: true` is the client's default, left unchanged), which fires `onAuthStateChange` the same way any other session change does.
- `sendMagicLink(email)`: sets `status: 'sending'`, calls `supabase.auth.signInWithOtp({ email })`. On success, `status: 'sent'`. On error, `status: 'error'` with a generic Hebrew message in `errorMessage` (never the raw Supabase error text — matches `Settings.tsx`'s existing "קובץ לא תקין" pattern of a fixed, translated message rather than surfacing internals).
- `signOut()`: calls `supabase.auth.signOut()`. The `onAuthStateChange` subscription from `init()` is what actually clears `email` back to `null` (one source of truth for session state, not a duplicate manual `set`) — `signOut()` itself doesn't need to touch `email`.

## Section 3: Settings page — Account section

A new section in `kb-app/src/pages/Settings.tsx`, titled "חשבון", placed **above** the existing Export/Import sections (signing in is the more primary action on this page).

**Signed out** (`email === null`): an email field + submit button, using `SearchBar.tsx`'s existing bordered-label input pattern:

```tsx
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
  disabled={status === 'sending'}
  className="min-h-11 w-fit rounded-md border border-[var(--kb-border)] px-4 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] disabled:opacity-50"
>
  שלח קישור התחברות
</button>
```

Wrapped in a `<form onSubmit={...}>` so `required`/`type="email"` native validation runs before `sendMagicLink` is ever called — no client-side regex needed. The submit handler bridges `authStore`'s async result into `Settings.tsx`'s own local `message` state (Section 3 below), mirroring exactly how `handleFileSelected` already awaits an async call and then calls `setMessage(...)` with the outcome:

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
```

`disabled={useAuthStore((s) => s.status === 'sending')}` on the submit button (a reactive selector, not a one-time read, so the button re-enables the moment `sendMagicLink`'s `await` resolves and `status` changes away from `'sending'`).

- On success: the message-state pattern above shows `קישור נשלח ל-<email>, בדוק את תיבת הדואר.` — the signed-out form stays visible underneath (unlike Export/Import's messages, nothing here needs to be replaced, since the user may want to resend or correct the email).
- On error: the same shared message slot shows `errorMessage` (or a fallback) as a `role="alert"`, form stays visible so the user can retry.

**Signed in** (`email !== null`): replaces the form entirely with `מחובר כ: <email>` + a "התנתק" button calling `authStore.signOut()`. No confirmation dialog needed — unlike Export/Import's destructive full-overwrite, sign-out has no data-loss consequence (Section 1's "out of scope" — local data is untouched).

**Message-state reuse:** Settings.tsx already has one local `message: { kind: 'success' | 'error'; text: string } | null` state used by Export/Import. The Account section's "sent"/"error" messages reuse the exact same state and the same `role={kind === 'error' ? 'alert' : 'status'}` element — one message slot for the whole page, not a second one, since only one action (export, import, or now sign-in) is ever in flight at a time on this page.

## Section 4: `App.tsx` — one line added to the existing effect

`App.tsx`'s current mount effect:
```tsx
useEffect(() => {
  void useUserDataStore.getState().loadUserData();
}, []);
```
becomes:
```tsx
useEffect(() => {
  void useUserDataStore.getState().loadUserData();
  useAuthStore.getState().init();
}, []);
```
`init()` is synchronous (it only sets up the `onAuthStateChange` subscription and kicks off `getSession()`), so no `void`/await handling is needed — matching the existing effect's style of two independent, unrelated bootstrap calls in one effect rather than two effects (there's already exactly one mount effect in `App.tsx`; this reuses it rather than adding a second).

## Testing

- `authStore.test.ts`: mocks `../lib/supabase` (`vi.mock('../lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: vi.fn(), getSession: vi.fn(), signInWithOtp: vi.fn(), signOut: vi.fn() } } }))`) — no real network calls, same principle as `db.test.ts` using `fake-indexeddb` instead of a real database. Covers: `init()` sets `email` from an existing session; `init()`'s subscription callback updates `email` on a later auth event; `sendMagicLink` success → `status: 'sent'`; `sendMagicLink` failure → `status: 'error'` with the generic message, not the raw Supabase error; `signOut()` calls `supabase.auth.signOut()` (state change itself is exercised via the `onAuthStateChange` callback, not asserted as a direct `set` from `signOut()`).
- `Settings.test.tsx`: new cases for the signed-out form (renders, submits, disables the button while `status === 'sending'`), the "sent" message, the "error" message, and the signed-in view + sign-out button — mocking `authStore`'s Zustand state the same way existing `Settings.test.tsx`/`Header.test.tsx` tests mock `useUserDataStore.setState(...)`.
- Manual, not testable in jsdom (post-implementation, once a real Supabase project exists): enter a real email, confirm the magic-link email arrives, click it, confirm the app shows "מחובר כ: ..." after redirect; sign out, confirm local data (progress/notes/favorites/SRS) is completely unaffected; sign in on a second browser/profile with the same email, confirm session state doesn't leak between them (each browser has its own local session).

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green (tests need no live Supabase project — everything is mocked).
- `kb-app/.env.example` added with placeholder values; `.env` confirmed still gitignored (golden rule 8).
- Light theme, dark theme, RTL checked on the new Account section (signed-out form, sent/error messages, signed-in view).
- Keyboard-only: email field and both buttons reachable and operable via keyboard, `focus-visible` present (golden rule 6).
- No hardcoded colors — only `--kb-*` tokens (golden rule 7).
- No regression to Export/Import (Section 3's shared `message` state must not cross-contaminate between Account and Export/Import flows — e.g. a "sent" message from Account must not linger and get misread as an export/import result, or vice versa).
