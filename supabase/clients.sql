-- ============================================================
-- AL BALQAN — Client Application & Document module
-- Run this ONCE in: Supabase Dashboard -> SQL Editor -> Run
-- (Safe to re-run. If the storage part fails you still get the tables.)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Referral agents (one list per authenticated user)
-- ------------------------------------------------------------
create table if not exists public.referral_agents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists referral_agents_user_name_idx
  on public.referral_agents (user_id, lower(name));

create index if not exists referral_agents_user_id_idx
  on public.referral_agents (user_id);

alter table public.referral_agents enable row level security;

drop policy if exists "own select" on public.referral_agents;
create policy "own select" on public.referral_agents
  for select using (auth.uid() = user_id);

drop policy if exists "own insert" on public.referral_agents;
create policy "own insert" on public.referral_agents
  for insert with check (auth.uid() = user_id);

drop policy if exists "own update" on public.referral_agents;
create policy "own update" on public.referral_agents
  for update using (auth.uid() = user_id);

drop policy if exists "own delete" on public.referral_agents;
create policy "own delete" on public.referral_agents
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. Clients (the whole client record lives in `data`)
-- ------------------------------------------------------------
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_user_id_idx
  on public.clients (user_id);

create index if not exists clients_created_at_idx
  on public.clients (created_at);

alter table public.clients enable row level security;

drop policy if exists "own select" on public.clients;
create policy "own select" on public.clients
  for select using (auth.uid() = user_id);

drop policy if exists "own insert" on public.clients;
create policy "own insert" on public.clients
  for insert with check (auth.uid() = user_id);

drop policy if exists "own update" on public.clients;
create policy "own update" on public.clients
  for update using (auth.uid() = user_id);

drop policy if exists "own delete" on public.clients;
create policy "own delete" on public.clients
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. Storage buckets + access policy
--    Wrapped in a DO block so a storage-permission problem can
--    NEVER roll back the two tables created above.
--    Check the messages at the bottom of the SQL Editor output.
-- ------------------------------------------------------------
do $$
begin
  begin
    insert into storage.buckets (id, name, public)
    values ('client-documents', 'client-documents', false)
    on conflict (id) do nothing;

    insert into storage.buckets (id, name, public)
    values ('client-pdfs', 'client-pdfs', false)
    on conflict (id) do nothing;
    raise notice 'BUCKETS OK: client-documents, client-pdfs';
  exception when others then
    raise notice 'BUCKETS FAILED: %  -> create them manually: Storage -> New bucket -> name: client-documents -> Public: OFF -> Save bucket (repeat for client-pdfs)', sqlerrm;
  end;

  begin
    drop policy if exists "client documents owner" on storage.objects;
    create policy "client documents owner" on storage.objects
      for all to authenticated
      using (bucket_id in ('client-documents', 'client-pdfs')
             and (storage.foldername(name))[1] = 'clients'
             and auth.uid()::text = (storage.foldername(name))[2])
      with check (bucket_id in ('client-documents', 'client-pdfs')
                  and (storage.foldername(name))[1] = 'clients'
                  and auth.uid()::text = (storage.foldername(name))[2]);
    raise notice 'STORAGE POLICY OK';
  exception when others then
    raise notice 'STORAGE POLICY FAILED: %  -> tell me the message', sqlerrm;
  end;
end $$;
