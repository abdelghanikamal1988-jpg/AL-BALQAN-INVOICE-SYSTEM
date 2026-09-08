-- ============================================================
-- AL BALQAN Invoice System — Supabase schema
-- Run this once in your Supabase project's SQL editor.
-- ============================================================

-- Invoices table (the whole invoice object lives in the `data` column)
create table if not exists public.invoices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists invoices_user_id_idx
  on public.invoices (user_id);

create index if not exists invoices_created_at_idx
  on public.invoices (created_at);

-- Row Level Security: every user can only see their own invoices
alter table public.invoices enable row level security;

drop policy if exists "own select" on public.invoices;
create policy "own select" on public.invoices
  for select using (auth.uid() = user_id);

drop policy if exists "own insert" on public.invoices;
create policy "own insert" on public.invoices
  for insert with check (auth.uid() = user_id);

drop policy if exists "own update" on public.invoices;
create policy "own update" on public.invoices
  for update using (auth.uid() = user_id);

drop policy if exists "own delete" on public.invoices;
create policy "own delete" on public.invoices
  for delete using (auth.uid() = user_id);