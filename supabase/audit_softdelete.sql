-- ============================================================
-- AL BALQAN — Audit trail, soft delete, referral agent FK
-- Run this ONCE in: Supabase Dashboard -> SQL Editor -> Run
-- (Safe to re-run.)
-- ============================================================

-- ============================================================
-- 1. AUDIT LOG
--    Every INSERT / UPDATE / DELETE on the business tables is
--    recorded here with the old and new row, so an admin can
--    always answer "who changed what, and when".
-- ============================================================

create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  table_name    text not null,
  record_id     uuid,
  action        text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data      jsonb,
  new_data      jsonb,
  changed_keys  text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists audit_log_user_id_idx
  on public.audit_log (user_id);

create index if not exists audit_log_table_record_idx
  on public.audit_log (table_name, record_id);

create index if not exists audit_log_created_at_idx
  on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "own select" on public.audit_log;
create policy "own select" on public.audit_log
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own insert" on public.audit_log;
create policy "own insert" on public.audit_log
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- 2. Trigger function: log the change
--    Runs as SECURITY DEFINER so RLS on the audited table can
--    never prevent the log row from being written.
-- ============================================================

create or replace function public.audit_log_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_keys text[] := '{}';
  v_record_id uuid;
begin
  if TG_OP = 'INSERT' then
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id')::uuid;
    insert into public.audit_log (user_id, table_name, record_id, action, new_data, changed_keys)
    values (auth.uid(), TG_TABLE_NAME, v_record_id, 'INSERT', v_new, array['*']);
    return NEW;

  elsif TG_OP = 'UPDATE' then
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id')::uuid;

    /* Which top-level keys actually changed? */
    select coalesce(array_agg(k), '{}')
    into v_keys
    from (
      select coalesce(a.key, b.key) as k
      from jsonb_each(v_old) a
      full outer join jsonb_each(v_new) b on a.key = b.key
      where a.value is distinct from b.value
    ) diff;

    /* Skip no-op updates (e.g. a touch of updated_at with nothing else). */
    if v_keys = array['*']::text[] or (array_length(v_keys, 1) = 1 and v_keys[1] = 'updated_at') then
      return NEW;
    end if;

    insert into public.audit_log (user_id, table_name, record_id, action, old_data, new_data, changed_keys)
    values (auth.uid(), TG_TABLE_NAME, v_record_id, 'UPDATE', v_old, v_new, v_keys);
    return NEW;

  elsif TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
    v_record_id := (v_old->>'id')::uuid;
    insert into public.audit_log (user_id, table_name, record_id, action, old_data, changed_keys)
    values (auth.uid(), TG_TABLE_NAME, v_record_id, 'DELETE', v_old, array['*']);
    return OLD;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_audit_invoices on public.invoices;
create trigger trg_audit_invoices
  after insert or update or delete on public.invoices
  for each row execute function public.audit_log_row();

drop trigger if exists trg_audit_clients on public.clients;
create trigger trg_audit_clients
  after insert or update or delete on public.clients
  for each row execute function public.audit_log_row();

drop trigger if exists trg_audit_consultations on public.consultation_requests;
create trigger trg_audit_consultations
  after insert or update or delete on public.consultation_requests
  for each row execute function public.audit_log_row();

drop trigger if exists trg_audit_payments on public.invoice_payments;
create trigger trg_audit_payments
  after insert or update or delete on public.invoice_payments
  for each row execute function public.audit_log_row();

-- ============================================================
-- 3. SOFT DELETE
--    A deleted_at timestamp is stamped instead of removing the
--    row, so nothing is ever lost and anything can be restored.
-- ============================================================

alter table public.invoices add column if not exists deleted_at timestamptz;
alter table public.clients  add column if not exists deleted_at timestamptz;
alter table public.consultation_requests add column if not exists deleted_at timestamptz;

create index if not exists invoices_deleted_at_idx
  on public.invoices (deleted_at) where deleted_at is null;

create index if not exists clients_deleted_at_idx
  on public.clients (deleted_at) where deleted_at is null;

-- ============================================================
-- 4. REFERRAL AGENT as a real foreign key
--    The client jsonb keeps referralAgent (the display name) so
--    nothing breaks; a new nullable column holds the id so the
--    link survives a rename.
-- ============================================================

alter table public.clients add column if not exists referral_agent_id uuid
  references public.referral_agents(id) on delete set null;

create index if not exists clients_referral_agent_id_idx
  on public.clients (referral_agent_id);

-- Back-fill: match existing clients to agents by name (case-insensitive).
update public.clients c
set referral_agent_id = a.id
from public.referral_agents a
where c.referral_agent_id is null
  and c.data->>'referralAgent' is not null
  and lower(trim(c.data->>'referralAgent')) = lower(trim(a.name));

-- ============================================================
-- 5. Helper: restore a soft-deleted row
-- ============================================================

create or replace function public.restore_record(p_table text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean := false;
begin
  if p_table = 'invoices' then
    update public.invoices set deleted_at = null where id = p_id and deleted_at is not null;
    get diagnostics v_ok = row_count;
  elsif p_table = 'clients' then
    update public.clients set deleted_at = null where id = p_id and deleted_at is not null;
    get diagnostics v_ok = row_count;
  elsif p_table = 'consultation_requests' then
    update public.consultation_requests set deleted_at = null where id = p_id and deleted_at is not null;
    get diagnostics v_ok = row_count;
  end if;
  return v_ok;
end;
$$;
