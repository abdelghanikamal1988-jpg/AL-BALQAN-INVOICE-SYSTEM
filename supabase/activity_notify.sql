-- ============================================================
-- AL BALQAN — "something new was added" bell notifications
--
-- Whenever an account adds a client, opens an invoice or submits an
-- edit for approval, every ACTIVE ADMIN who did NOT do it themselves
-- gets a notifications row, so the bell shows a badge even when
-- nobody happened to have the page open. Consultations already write
-- their own rows (consultation_notify.sql); visas write theirs in
-- visa_publish.sql.
--
-- notify_admins() is SECURITY DEFINER — the row is written for OTHER
-- users, which Row Level Security forbids — and it refuses to run
-- outside a trigger, so no account can post a fake notice itself.
-- The record's owner is skipped, so nobody is told about their own
-- work; a server-side insert with no session (auth.uid() is null)
-- tells every admin.
-- Safe to re-run: CREATE OR REPLACE + drop/create triggers.
-- ============================================================

create or replace function public.notify_admins(p_type text, p_payload jsonb, p_link text, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if coalesce(pg_trigger_depth(), 0) = 0 then
    raise exception 'not authorized';
  end if;

  insert into public.notifications (user_id, type, payload, link)
  select id, p_type, p_payload, p_link
  from public.profiles
  where is_active
    and role = 'admin'
    and (p_actor is null or id <> p_actor);

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

create or replace function public.activity_client_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_by    text := '';
  v_name  text;
begin
  v_actor := coalesce(auth.uid(), NEW.user_id);

  select coalesce(u.email, '') into v_by
    from auth.users u
   where u.id = v_actor;

  v_name := left(trim(both ' ' from
             coalesce(NEW.data ->> 'firstName', '') || ' ' ||
             coalesce(NEW.data ->> 'fatherName', '') || ' ' ||
             coalesce(NEW.data ->> 'surname', '')), 120);

  perform public.notify_admins(
    'client_new',
    jsonb_build_object(
      'name', v_name,
      'fileNo', left(coalesce(NEW.data ->> 'fileNo', ''), 40),
      'by', v_by
    ),
    '/clients/' || NEW.id::text,
    v_actor
  );

  return NEW;
end;
$$;

create or replace function public.activity_invoice_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_by    text := '';
  v_name  text;
begin
  v_actor := coalesce(auth.uid(), NEW.user_id);

  select coalesce(u.email, '') into v_by
    from auth.users u
   where u.id = v_actor;

  v_name := left(coalesce(nullif(NEW.data ->> 'invoiceNumber', ''),
                           NEW.data -> 'client' ->> 'name',
                           ''), 120);

  perform public.notify_admins(
    'invoice_new',
    jsonb_build_object(
      'name', v_name,
      'client', left(coalesce(NEW.data -> 'client' ->> 'name', ''), 120),
      'fileNo', left(coalesce(NEW.data -> 'client' ->> 'fileNo', ''), 40),
      'by', v_by
    ),
    '/history',
    v_actor
  );

  return NEW;
end;
$$;

create or replace function public.activity_pending_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_by    text := '';
  v_name  text := '';
  v_file  text := '';
  v_link  text;
begin
  v_actor := coalesce(auth.uid(), NEW.user_id);

  select coalesce(u.email, '') into v_by
    from auth.users u
   where u.id = v_actor;

  if NEW.entity_type = 'client' then
    v_name := left(trim(both ' ' from
                 coalesce(NEW.payload ->> 'firstName', '') || ' ' ||
                 coalesce(NEW.payload ->> 'fatherName', '') || ' ' ||
                 coalesce(NEW.payload ->> 'surname', '')), 120);
    v_file := left(coalesce(NEW.payload ->> 'fileNo', ''), 40);
    v_link := '/clients/' || NEW.entity_id;
  else
    v_name := left(coalesce(nullif(NEW.payload ->> 'invoiceNumber', ''),
                             NEW.payload -> 'client' ->> 'name',
                             ''), 120);
    v_file := left(coalesce(NEW.payload -> 'client' ->> 'fileNo', ''), 40);
    v_link := '/history';
  end if;

  perform public.notify_admins(
    'edit_submitted',
    jsonb_build_object(
      'name', v_name,
      'fileNo', v_file,
      'entity', left(coalesce(NEW.entity_type, ''), 20),
      'by', v_by
    ),
    v_link,
    v_actor
  );

  return NEW;
end;
$$;

drop trigger if exists trg_activity_clients on public.clients;
create trigger trg_activity_clients
  after insert on public.clients
  for each row execute function public.activity_client_insert();

drop trigger if exists trg_activity_invoices on public.invoices;
create trigger trg_activity_invoices
  after insert on public.invoices
  for each row execute function public.activity_invoice_insert();

drop trigger if exists trg_activity_pending on public.pending_edits;
create trigger trg_activity_pending
  after insert on public.pending_edits
  for each row execute function public.activity_pending_insert();

revoke execute on function public.notify_admins(text, jsonb, text, uuid) from public;
revoke execute on function public.notify_admins(text, jsonb, text, uuid) from anon;
revoke execute on function public.notify_admins(text, jsonb, text, uuid) from authenticated;
