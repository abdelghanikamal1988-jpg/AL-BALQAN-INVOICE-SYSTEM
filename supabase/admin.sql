-- ============================================================
-- AL BALQAN — Admin panel: profiles, roles & permissions
-- Run ONCE in: Supabase Dashboard -> SQL Editor -> Run
-- (Safe to re-run — every statement uses IF NOT EXISTS /
--  CREATE OR REPLACE / DROP policy IF EXISTS.)
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) profiles — one row per auth user (role + permissions)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'custom'
              check (role in ('admin', 'employee', 'delegate', 'custom')),
  permissions jsonb not null default '[]'::jsonb,   -- array of "page:*" / "action:*"
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));

alter table public.profiles enable row level security;

-- ------------------------------------------------------------
-- 2) backfill — give every EXISTING user a profile
-- ------------------------------------------------------------
insert into public.profiles (id, email, full_name)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data ->> 'name', '')
from auth.users u
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3) auto-create a profile when someone signs up
--    (role 'custom' + no permissions = "waiting for admin")
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 4) is_admin() — SECURITY DEFINER so it can be used inside
--    RLS policies without recursion
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active
  );
$$;

-- ------------------------------------------------------------
-- 5) profiles RLS — read own row / admin reads all.
--    No INSERT/UPDATE/DELETE policies for clients: profile
--    writes only happen via the trigger above and the admin
--    RPCs below (both SECURITY DEFINER, so they bypass RLS).
-- ------------------------------------------------------------
drop policy if exists "profiles select own or admin" on public.profiles;
create policy "profiles select own or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

-- ------------------------------------------------------------
-- 6) admin RPCs — every one of them checks is_admin() first
-- ------------------------------------------------------------

-- 6a) create a user (auth.users + profile with role/permissions)
create or replace function public.admin_create_user(
  p_email       text,
  p_password    text,
  p_full_name   text default '',
  p_role        text default 'custom',
  p_permissions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create users';
  end if;
  if p_email is null or position('@' in p_email) = 0 then
    raise exception 'A valid email is required';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = lower(p_email)) then
    raise exception 'That email is already registered';
  end if;

  v_id := gen_random_uuid();

  -- NOTE: token columns are written as '' (not NULL) exactly like GoTrue
  -- does — NULL there makes the auth server return 500 on login.
  insert into auth.users (
    instance_id, id, aud, role,
    email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_old,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_id, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf', 10)), now(),
    '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', p_full_name),
    now(), now()
  );

  -- email/password logins are resolved through auth.identities —
  -- without this row the auth server rejects the user with
  -- "Invalid login credentials".
  insert into auth.identities (
    id, user_id, provider_id, provider,
    identity_data, last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), v_id, v_id::text, 'email',
    jsonb_build_object('sub', v_id, 'email', lower(p_email), 'email_verified', true),
    now(), now(), now()
  )
  on conflict do nothing;

  -- the trigger above created the profile with defaults;
  -- now apply the chosen role / permissions / name.
  update public.profiles
     set full_name   = coalesce(nullif(p_full_name, ''), full_name),
         role        = p_role,
         permissions = p_permissions,
         updated_at  = now()
   where id = v_id;

  return v_id;
end;
$$;

-- 6b) edit an existing user
create or replace function public.admin_update_user(
  p_id          uuid,
  p_full_name   text default null,
  p_role        text default null,
  p_permissions jsonb default null,
  p_is_active   boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can edit users';
  end if;
  if p_id = auth.uid() then
    raise exception 'You cannot edit your own account here';
  end if;

  update public.profiles
     set full_name   = coalesce(p_full_name, full_name),
         role        = coalesce(p_role, role),
         permissions = coalesce(p_permissions, permissions),
         is_active   = coalesce(p_is_active, is_active),
         updated_at  = now()
   where id = p_id;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

-- 6c) set a new password (and force the user to log in again)
create or replace function public.admin_set_password(
  p_id       uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change passwords';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf', 10)),
         updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'User not found';
  end if;

  delete from auth.refresh_tokens where user_id::text = p_id::text; -- force re-login
end;
$$;

-- 6d) delete a user (cascades: profile, invoices, clients, agents)
create or replace function public.admin_delete_user(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete users';
  end if;
  if p_id = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;

  delete from auth.users where id = p_id;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

-- only signed-in users may call these (never anon)
revoke all on function public.admin_create_user(text, text, text, text, jsonb) from public, anon;
revoke all on function public.admin_update_user(uuid, text, text, jsonb, boolean) from public, anon;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_create_user(text, text, text, text, jsonb) to authenticated;
grant execute on function public.admin_update_user(uuid, text, text, jsonb, boolean) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ------------------------------------------------------------
-- 7) data RLS: owner OR admin (admins see/edit everything)
-- ------------------------------------------------------------
drop policy if exists "own select" on public.invoices;
create policy "own select" on public.invoices for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own insert" on public.invoices;
create policy "own insert" on public.invoices for insert
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "own update" on public.invoices;
create policy "own update" on public.invoices for update
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own delete" on public.invoices;
create policy "own delete" on public.invoices for delete
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own select" on public.clients;
create policy "own select" on public.clients for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own insert" on public.clients;
create policy "own insert" on public.clients for insert
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "own update" on public.clients;
create policy "own update" on public.clients for update
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own delete" on public.clients;
create policy "own delete" on public.clients for delete
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own select" on public.referral_agents;
create policy "own select" on public.referral_agents for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own insert" on public.referral_agents;
create policy "own insert" on public.referral_agents for insert
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "own update" on public.referral_agents;
create policy "own update" on public.referral_agents for update
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own delete" on public.referral_agents;
create policy "own delete" on public.referral_agents for delete
  using (auth.uid() = user_id or public.is_admin());

-- storage: admins can read/write the client document buckets
drop policy if exists "client documents admin" on storage.objects;
create policy "client documents admin" on storage.objects
  for all to authenticated
  using (bucket_id in ('client-documents', 'client-pdfs') and public.is_admin())
  with check (bucket_id in ('client-documents', 'client-pdfs') and public.is_admin());

-- ------------------------------------------------------------
-- 8) ★ YOU: replace with YOUR login email, uncomment, run once
--    (then you are the first admin and can add users from the
--     Users page in the app)
-- ------------------------------------------------------------
-- update public.profiles
--    set role = 'admin', updated_at = now()
--  where lower(email) = 'your-email@example.com';

-- check who is admin:
-- select email, role, is_active from public.profiles order by created_at;
