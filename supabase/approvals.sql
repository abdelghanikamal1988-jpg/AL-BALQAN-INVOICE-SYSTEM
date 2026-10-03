-- ============================================================
--  AL BALQAN — Edit approval workflow  (pending_edits table)
--
--  Run ONCE in the Supabase SQL Editor, AFTER admin.sql
--  (this script uses public.is_admin() created by admin.sql).
--
--  How it works:
--    * When a non-admin user saves an EDIT to an invoice or a
--      client, the new values are stored here as `pending`.
--    * The original record stays unchanged until an admin
--      approves the proposal (the app applies the payload).
--    * An admin can also reject a proposal; the record and the
--      proposal's original values simply stay as they were.
-- ============================================================

create table if not exists public.pending_edits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('invoice', 'client')),
  entity_id   text not null,
  payload     jsonb not null,
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id)
);

create index if not exists pending_edits_entity_idx
  on public.pending_edits (entity_type, entity_id, status);

alter table public.pending_edits enable row level security;

-- The submitting user and admins can see a proposal.
drop policy if exists "pending select" on public.pending_edits;
create policy "pending select"
  on public.pending_edits for select
  using (auth.uid() = user_id or public.is_admin());

-- Any signed-in user may submit (only for themselves).
-- The UI gates this behind action:invoice.save / action:client.save.
drop policy if exists "pending insert" on public.pending_edits;
create policy "pending insert"
  on public.pending_edits for insert
  with check (auth.uid() = user_id);

-- Only admins approve / reject.
drop policy if exists "pending update admin" on public.pending_edits;
create policy "pending update admin"
  on public.pending_edits for update
  using (public.is_admin())
  with check (public.is_admin());

-- The owner may withdraw a proposal; admins may remove any.
drop policy if exists "pending delete" on public.pending_edits;
create policy "pending delete"
  on public.pending_edits for delete
  using (auth.uid() = user_id or public.is_admin());
