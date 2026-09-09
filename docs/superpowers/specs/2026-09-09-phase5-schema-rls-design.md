# Phase 5, Sub-project #3 — Database Schema + RLS: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** [[2026-09-09-phase5-auth-design]] (needs `auth.users` to exist as the FK target — schema is written and reviewable without a live project, but can only actually be *applied* once a Supabase project exists).
**Scope boundary:** the first of three pieces Phase 5's original Sub-project #3 ("סכימת DB + מנוע סנכרון") was decomposed into during brainstorming. This piece is schema + RLS only — no sync engine code, no app wiring. Sub-project #4 (sync engine core: `pushDirty`/`pullSince`/`fullSync`) and #5 (wiring into `userDataStore` + auto-sync triggers) follow, once this schema exists to sync against.

## Goal

Produce `kb-app/supabase/schema.sql`: the four Postgres tables that mirror the local IndexedDB stores, with Row-Level Security locking every row to its owner. This is declarative SQL, reviewed and committed like any other source file, but *applied* by hand — pasted into Supabase Studio's SQL editor once a real project exists (decided during brainstorming: no Supabase CLI, no migrations directory, consistent with this project's toolset so far).

## Out of scope

The sync engine itself (sub-project #4). Any app code changes (sub-project #5) — this piece touches nothing under `src/`. `recents` — confirmed local-only in sub-project #1 (Export/Import) and absent from the original `04-BACKEND-SUPABASE-SYNC.md` design; low-stakes, device-local-feeling data with no reason to gain a cloud table now. Actually running the SQL against a live project — no such project exists yet; that's a manual step for whenever the user creates one.

## Section 1: Tables

Four tables, one per synced local store, each keyed on `(user_id, topic_id)` — matching `04-BACKEND-SUPABASE-SYNC.md`'s original design, with two corrections against the local types actually in `kb-app/src/types.ts` today:

```sql
-- Enable RLS on every table; the (user_id, topic_id) primary key
-- prevents duplicate rows per user per topic.

create table progress (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  status text not null check (status in ('new','learning','mastered')),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index progress_user_updated_idx on progress (user_id, updated_at);

create table notes (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  text text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index notes_user_updated_idx on notes (user_id, updated_at);

create table favorites (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index favorites_user_updated_idx on favorites (user_id, created_at);

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
```

**Correction 1 — `srs_cards.due_at` is `not null`.** The original doc's draft left it nullable. The local `SrsCard` type (`kb-app/src/types.ts:66-74`) has `dueAt: number` as a required field with no null case — a card only gets a row (locally, via `srs.ts`'s grading flow) once it's been graded at least once, at which point `dueAt` is always set. A row existing with a null due date isn't a state the local app ever produces, so the column shouldn't allow it either — it would only let a bug write inconsistent data. `default now()` mirrors the other timestamp columns' pattern rather than leaving no default for a `not null` column.

**Correction 2 — a `(user_id, updated_at)` index on every table** (using `created_at` for `favorites`, which has no `updated_at` — matching its local `Favorite` type at `types.ts:50-53`, which also only has `createdAt`). The bare `(user_id, topic_id)` primary key supports "all of this user's rows" and "this exact row," but sub-project #4's `pullSince(ts)` needs "this user's rows changed after timestamp ts" — a query the primary key alone can't serve efficiently. Cheap to add now, before there's data to migrate around.

**Timestamp representation:** these columns are `timestamptz`; the local IndexedDB rows carry epoch-millisecond `number`s (`updatedAt`/`createdAt`/`dueAt`). Converting between the two directions (`new Date(ms).toISOString()` for a push, `new Date(row.updated_at).getTime()` for a pull) is sub-project #4's job, not this schema's — noted here so the boundary is explicit and isn't lost between pieces.

## Section 2: Row-Level Security

Identical policy shape on all four tables — a user can only see or modify their own rows:

```sql
alter table progress enable row level security;
create policy "own rows" on progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table notes enable row level security;
create policy "own rows" on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table favorites enable row level security;
create policy "own rows" on favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table srs_cards enable row level security;
create policy "own rows" on srs_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`for all` covers select/insert/update/delete with one policy per table rather than four — this project has no admin/service role that needs different rules, so there's no reason to split them.

## Section 3: File and application workflow

- New file: `kb-app/supabase/schema.sql` — the two SQL blocks above, concatenated in table-then-policy order per table (matches how `04-BACKEND-SUPABASE-SYNC.md` presents it, and keeps each table's full definition — including its RLS — readable as one unit rather than two separate blocks of four statements each).
- A short header comment in the file states it's applied manually via Supabase Studio → SQL Editor → paste → run, and that it's idempotent-unsafe (no `if not exists` guards) — intentional, since this is a one-time-per-project setup script, not a repeatable migration. Re-running it against a project that already has these tables will error on `create table`, which is the correct signal that setup already happened.
- No CI, no build-time validation of this file — it's inert to `npm run build`/`typecheck`/`lint`/`test`, none of which touch `kb-app/supabase/`.

## Testing

None in the Vitest sense — this is declarative SQL with no TypeScript surface and no runtime code path exercises it yet (sub-project #4 is what will actually connect to these tables). "Tested" here means manually verified once a live project exists, per the Definition of Done below.

## Definition of Done

- `kb-app/supabase/schema.sql` committed, containing all four tables + indexes + RLS policies from Sections 1–2.
- Manual verification (deferred until a real Supabase project exists — not a blocker for merging this piece, since the file is inert until pasted in):
  - Paste into Supabase Studio's SQL editor, run once, confirm no errors.
  - `\d progress` (and the other three) in the SQL editor shows the expected columns, the `(user_id, topic_id)` primary key, the `(user_id, updated_at)`-shaped index, and RLS enabled.
  - Quick RLS check: insert a row as one authenticated test user, confirm a second test user's session can't see or modify it.
- No changes to any file under `kb-app/src/` — this piece is additive-only (one new file).
