# Phase 5, Sub-project #3 — Database Schema + RLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `kb-app/supabase/schema.sql` — the four Postgres tables (`progress`, `notes`, `favorites`, `srs_cards`) that mirror the local IndexedDB stores, each with RLS locking rows to their owner, plus supporting indexes for the future sync engine's `pullSince(ts)` query.

**Architecture:** One new, inert SQL file. No app code changes, no dependencies, no build/test-pipeline involvement — `kb-app/supabase/` is outside every existing typecheck/lint/test/build glob. Applied manually via Supabase Studio's SQL editor once a live project exists (not part of this plan — no project exists yet).

**Tech Stack:** Plain PostgreSQL DDL (as used by Supabase). No new libraries.

**Spec:** `docs/superpowers/specs/2026-09-09-phase5-schema-rls-design.md`

## Global Constraints

- File location: `kb-app/supabase/schema.sql` (matches `kb-app/CLAUDE.md`'s documented structure: "`supabase/schema.sql`").
- Four tables only: `progress`, `notes`, `favorites`, `srs_cards`. No `recents` table (confirmed local-only, out of scope — see spec).
- Every table: primary key `(user_id, topic_id)`, `user_id uuid references auth.users on delete cascade`, RLS enabled with a single `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)` policy.
- Every table gets a supporting index: `(user_id, updated_at)` — except `favorites`, which has no `updated_at` locally or in this schema, so its index is `(user_id, created_at)`.
- `srs_cards.due_at` is `timestamptz not null default now()` — NOT nullable (correction from spec Section 1; the original `04-BACKEND-SUPABASE-SYNC.md` draft left it nullable, but the local `SrsCard.dueAt: number` type is always present).
- No `if not exists` guards anywhere — this is an intentional one-time setup script, not a repeatable migration (see spec Section 3).
- This plan makes NO changes under `kb-app/src/` — additive-only, one new file.
- After the file exists, the project's existing pipeline (`npm run typecheck && npm run lint && npm run test && npm run build`, run from `kb-app/`) must stay green — this file must not be picked up or break any of those.

---

### Task 1: Create `kb-app/supabase/schema.sql`

**Files:**
- Create: `kb-app/supabase/schema.sql`

**Interfaces:**
- Consumes: nothing (first and only task in this plan).
- Produces: the file itself, for sub-project #4 (sync engine) to target later. No code interface — this is a file existence + content deliverable, not a function/type.

There is no failing-test-first step here — this is declarative SQL with no TypeScript/JS surface to unit test (see spec's Testing section: "None in the Vitest sense"). The task is: write the exact file content, then verify it doesn't regress the existing pipeline, then commit.

- [ ] **Step 1: Write the file**

Create `kb-app/supabase/schema.sql` with exactly this content:

```sql
-- kb-app/supabase/schema.sql
--
-- Applied manually: paste this whole file into Supabase Studio's
-- SQL Editor and run it once, after creating the Supabase project.
-- Not idempotent by design (no `if not exists` guards) — this is a
-- one-time setup script, not a repeatable migration. Re-running it
-- against a project that already has these tables will error on
-- `create table`, which is the correct signal that setup already ran.

-- ============================================================
-- progress
-- ============================================================

create table progress (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  status text not null check (status in ('new','learning','mastered')),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index progress_user_updated_idx on progress (user_id, updated_at);

alter table progress enable row level security;
create policy "own rows" on progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- notes
-- ============================================================

create table notes (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  text text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index notes_user_updated_idx on notes (user_id, updated_at);

alter table notes enable row level security;
create policy "own rows" on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- favorites
-- ============================================================

create table favorites (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index favorites_user_updated_idx on favorites (user_id, created_at);

alter table favorites enable row level security;
create policy "own rows" on favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- srs_cards
-- ============================================================

create table srs_cards (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  ease real not null default 2.5,
  interval_days real not null default 0,
  due_at timestamptz not null default now(),
  reps int not null default 0,
  lapses int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index srs_cards_user_updated_idx on srs_cards (user_id, updated_at);

alter table srs_cards enable row level security;
create policy "own rows" on srs_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Verify no regression to the existing pipeline**

From `kb-app/`, run:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Expected: all four succeed, with the same pass/fail shape as before this file existed (this file lives outside every glob these commands touch, so the expectation is simply "unchanged green" — see Global Constraints). If any of them newly fails, something unexpected picked up the new file; investigate before continuing (most likely cause: an overly broad lint/test glob — do not work around it by excluding the file, report it as a plan-scope finding instead).

- [ ] **Step 3: Manual SQL sanity check (static, no live project needed)**

Read the file back and confirm by inspection:
- Exactly four `create table` statements: `progress`, `notes`, `favorites`, `srs_cards`.
- Every table has `primary key (user_id, topic_id)`.
- Every table has exactly one `create index ... (user_id, updated_at)` line, except `favorites`, whose index is `(user_id, created_at)`.
- Every table has `alter table <name> enable row level security;` followed by a `create policy "own rows" on <name> for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`.
- `srs_cards.due_at` reads `timestamptz not null default now()` — not nullable.
- No `if not exists` anywhere in the file.

This is a manual read-through, not a script — there is no automated linter for embedded SQL strings in this codebase, and adding one would be disproportionate to a 70-line static file.

- [ ] **Step 4: Commit**

```bash
git add kb-app/supabase/schema.sql
git commit -m "feat: add Supabase schema + RLS for progress/notes/favorites/srs_cards"
```

(Attribution trailer lines are appended automatically by the environment's commit convention — include them if your dispatch instructions show a specific trailer block; otherwise a plain commit message is fine for this task.)

---

## Definition of Done (whole plan)

- `kb-app/supabase/schema.sql` exists with the exact content from Task 1, Step 1.
- `npm run typecheck && npm run lint && npm run test && npm run build` (from `kb-app/`) all green, unchanged from pre-task baseline.
- No files under `kb-app/src/` touched.
- Manual verification against a live Supabase project (pasting the file into Studio's SQL editor, confirming table/index/RLS shape, confirming cross-user row isolation) is explicitly deferred — no live project exists yet. This does not block finishing this sub-project; it's a one-time step for whenever the user sets one up, and is already documented in the spec's Definition of Done.
