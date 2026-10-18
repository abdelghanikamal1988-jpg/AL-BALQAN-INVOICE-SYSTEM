-- ============================================================
-- AL BALQAN — Client-side error log
-- Run this ONCE in: Supabase Dashboard -> SQL Editor -> Run
-- (Safe to re-run.)
-- ============================================================

create table if not exists public.error_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  message     text not null,
  stack       text,
  component   text,
  page        text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists error_logs_user_id_idx
  on error_logs (user_id);

create index if not exists error_logs_created_at_idx
  on error_logs (created_at desc);

alter table public.error_logs enable row level security;

drop policy if exists "own select" on error_logs;
create policy "own select" on error_logs
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own insert" on error_logs;
create policy "own insert" on error_logs
  for insert with check (true);

-- House-keeping: drop rows older than 90 days so the table stays small.
create or replace function public.prune_error_logs()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.error_logs where created_at < now() - interval '90 days';
$$;
