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
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

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
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ============================================================
-- favorites
-- ============================================================

create table favorites (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index favorites_user_created_idx on favorites (user_id, created_at);

alter table favorites enable row level security;
create policy "own rows" on favorites
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ============================================================
-- srs_cards
-- ============================================================

create table srs_cards (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  ease double precision not null default 2.5,
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
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
