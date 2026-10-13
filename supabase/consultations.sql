-- ============================================================
-- AL BALQAN — Consultation requests (Netlify Forms sync)
-- Run this ONCE in: Supabase Dashboard -> SQL Editor -> Run
-- (Safe to re-run.)
-- ============================================================

create table if not exists public.consultation_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  netlify_id   text unique not null,
  form_name    text not null default 'consultation',
  full_name    text,
  email        text,
  phone        text,
  nationality  text,
  country      text,
  residence    text,
  service      text,
  details      text,
  consent      boolean,
  submitted_at timestamptz,
  raw_data     jsonb not null default '{}'::jsonb,
  status       text not null default 'new'
    check (status in ('new', 'in_progress', 'done', 'archived')),
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists consultation_requests_user_id_idx
  on public.consultation_requests (user_id);

create index if not exists consultation_requests_submitted_at_idx
  on public.consultation_requests (submitted_at desc);

create index if not exists consultation_requests_status_idx
  on public.consultation_requests (status);

-- Same RLS pattern as clients / invoices: per-user rows.
alter table public.consultation_requests enable row level security;

drop policy if exists "own select" on public.consultation_requests;
create policy "own select" on public.consultation_requests
  for select using (auth.uid() = user_id);

drop policy if exists "own insert" on public.consultation_requests;
create policy "own insert" on public.consultation_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "own update" on public.consultation_requests;
create policy "own update" on public.consultation_requests
  for update using (auth.uid() = user_id);

drop policy if exists "own delete" on public.consultation_requests;
create policy "own delete" on public.consultation_requests
  for delete using (auth.uid() = user_id);
