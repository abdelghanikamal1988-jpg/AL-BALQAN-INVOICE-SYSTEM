-- ============================================================
-- Per-user application state — everything the app used to keep in
-- browser localStorage now lives here, keyed by the signed-in user.
--   settings : business settings (name, TRN, VAT rate, prefix, …)
--   prefs    : UI preferences (theme, language, sidebar, onboarding)
--   draft    : the single in-progress invoice draft
-- Apply with:  python .dev/apply_sql.py supabase/userdata.sql
-- ============================================================

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  prefs      jsonb not null default '{}'::jsonb,
  draft      jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "own select" on public.user_data;
create policy "own select" on public.user_data
  for select using (auth.uid() = user_id);

drop policy if exists "own insert" on public.user_data;
create policy "own insert" on public.user_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "own update" on public.user_data;
create policy "own update" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own delete" on public.user_data;
create policy "own delete" on public.user_data
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Access log — sign-in / sign-out / failed attempt / idle timeout.
-- Was a 100-entry ring buffer in localStorage; now a queryable table.
-- A SECURITY DEFINER function writes it so a FAILED sign-in (no
-- session yet, user_id null) can still be recorded.
-- ============================================================

create table if not exists public.access_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  action     text not null,
  account    text not null default '',
  details    text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists access_logs_user_created_idx
  on public.access_logs (user_id, created_at desc);

alter table public.access_logs enable row level security;

drop policy if exists "own select" on public.access_logs;
create policy "signed-in select" on public.access_logs
  for select using (auth.uid() is not null);

drop policy if exists "own delete" on public.access_logs;
create policy "own delete" on public.access_logs
  for delete using (auth.uid() = user_id);

-- Writes go through this SECURITY DEFINER function so a FAILED sign-in
-- (no session yet, user_id null) is still recorded. It also prunes the
-- table to the newest 1000 rows so it cannot grow without bound.
create or replace function public.log_access(
  p_action  text,
  p_account text default '',
  p_details text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.access_logs (user_id, action, account, details)
  values (auth.uid(), p_action, p_account, p_details);
  delete from public.access_logs
  where id not in (
    select id from public.access_logs order by created_at desc limit 1000
  );
end;
$$;

revoke execute on function public.log_access(text, text, text) from public;
grant execute on function public.log_access(text, text, text) to anon, authenticated;

-- ============================================================
-- Backfill: give every existing auth user an empty row so the first
-- hydration always finds a row to read (upsert handles the rest too).
-- ============================================================

insert into public.user_data (user_id)
select id from auth.users
on conflict (user_id) do nothing;
