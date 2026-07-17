-- Grand Line Chart — Supabase schema.
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
--
-- The database holds ONE thing: users and their progress. Episode, chapter,
-- and arc data are not here — they're constants in app.js (reference data
-- that never changes once released; see the ARCS array there).

-- One row per signed-in user. Progress is stored as ranges — see
-- toRanges()/fromRanges() in app.js — a few hundred bytes even for a
-- finished voyage. `removed` is a per-medium {unit: ms timestamp} map of
-- recent unticks, used to break ties when merging two devices (progress
-- merges by union; an untick only wins if it's newer than what it's
-- competing with).
create table if not exists public.progress (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  anime_ranges jsonb not null default '[]',
  manga_ranges jsonb not null default '[]',
  history      jsonb not null default '{}',
  settings     jsonb not null default '{}',
  removed      jsonb not null default '{"anime":{},"manga":{}}',
  updated_at   timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "select own progress"
  on public.progress for select
  using (auth.uid() = user_id);

create policy "insert own progress"
  on public.progress for insert
  with check (auth.uid() = user_id);

create policy "update own progress"
  on public.progress for update
  using (auth.uid() = user_id);
