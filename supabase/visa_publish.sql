-- ============================================================
-- FINAL VISA WORKFLOW (upload by admin / action:client.visa,
-- publish to the agent with a notification).
-- Safe to re-run: every statement is idempotent.
--   1) can_visa()       — who may touch final-visa files
--   2) storage policies — owner/viewer rules now respect visa
--   3) notifications    — in-app bell rows (RPC-written only)
--   4) attach_visa()    — store / replace / detach the meta
--   5) publish_visa()   — APPROVED + timestamp + notify owner
-- ============================================================

-- 1) can_visa() ------------------------------------------------
create or replace function public.can_visa()
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
      and is_active
      and (role = 'admin' or permissions @> '["action:client.visa"]'::jsonb)
  );
$$;

revoke execute on function public.can_visa() from anon;
grant execute on function public.can_visa() to authenticated;

-- 2) storage policies -----------------------------------------
-- owner: full control of the own folder EXCEPT visa files
drop policy if exists "client documents owner" on storage.objects;
create policy "client documents owner" on storage.objects
  for all to authenticated
  using (bucket_id in ('client-documents', 'client-pdfs')
         and (storage.foldername(name))[1] = 'clients'
         and auth.uid()::text = (storage.foldername(name))[2]
         and name not like '%/visa.%')
  with check (bucket_id in ('client-documents', 'client-pdfs')
              and (storage.foldername(name))[1] = 'clients'
              and auth.uid()::text = (storage.foldername(name))[2]
              and name not like '%/visa.%');

-- viewer: the client owner reads files; visa only after publish
drop policy if exists "client documents viewer" on storage.objects;
create policy "client documents viewer" on storage.objects
  for select to authenticated
  using (bucket_id in ('client-documents', 'client-pdfs')
         and (storage.foldername(name))[1] = 'clients'
         and exists (select 1
                     from public.clients c
                     where c.id::text = (storage.foldername(name))[3]
                       and c.user_id = auth.uid())
         and (name not like '%/visa.%'
              or exists (select 1
                         from public.clients c
                         where c.id::text = (storage.foldername(name))[3]
                           and c.user_id = auth.uid()
                           and c.data ->> 'visaPublishedAt' is not null)));

-- visa: holders of action:client.visa work with visa files
-- anywhere (upload / replace / read / delete before publish)
drop policy if exists "client documents visa" on storage.objects;
create policy "client documents visa" on storage.objects
  for all to authenticated
  using (bucket_id in ('client-documents', 'client-pdfs')
         and public.can_visa()
         and ((storage.foldername(name))[1] = 'clients'
              and (name like '%/visa.%'
                   or auth.uid()::text = (storage.foldername(name))[2])))
  with check (bucket_id in ('client-documents', 'client-pdfs')
              and public.can_visa()
              and ((storage.foldername(name))[1] = 'clients'
                   and (name like '%/visa.%'
                        or auth.uid()::text = (storage.foldername(name))[2])));

-- 3) notifications --------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications own select" on public.notifications;
create policy "notifications own select"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifications own delete" on public.notifications;
create policy "notifications own delete"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.notifications from anon;
revoke insert on public.notifications from authenticated;
grant select, update, delete on public.notifications to authenticated;

-- 4) attach_visa(p_client_id, p_meta) ------------------------
-- p_meta = { path, name, size, type, key } → stored under
-- data.documents.visa; p_meta = null detaches it.
create or replace function public.attach_visa(p_client_id uuid, p_meta jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client record;
  v_docs   jsonb;
  v_ts     text;
begin
  if not public.can_visa() then
    raise exception 'not authorized';
  end if;

  select id, data, deleted_at
    into v_client
    from public.clients
   where id = p_client_id
   for update;

  if not found or v_client.deleted_at is not null then
    raise exception 'client not found';
  end if;

  v_ts   := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_docs := coalesce(v_client.data -> 'documents', '{}'::jsonb);

  if p_meta is null then
    v_docs := v_docs - 'visa';
  else
    v_docs := v_docs || jsonb_build_object('visa', p_meta);
  end if;

  update public.clients
     set data = v_client.data || jsonb_build_object('documents', v_docs, 'updatedAt', v_ts),
         updated_at = now()
   where id = p_client_id;

  return (select data from public.clients where id = p_client_id);
end;
$$;

revoke execute on function public.attach_visa(uuid, jsonb) from anon;
grant execute on function public.attach_visa(uuid, jsonb) to authenticated;

-- 5) publish_visa(p_client_id) --------------------------------
-- Requires an uploaded visa meta; stamps visaPublishedAt,
-- forces status APPROVED and notifies the record owner.
create or replace function public.publish_visa(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client record;
  v_ts     text;
  v_name   text;
begin
  if not public.can_visa() then
    raise exception 'not authorized';
  end if;

  select id, user_id, data, deleted_at
    into v_client
    from public.clients
   where id = p_client_id
   for update;

  if not found or v_client.deleted_at is not null then
    raise exception 'client not found';
  end if;

  if coalesce(v_client.data -> 'documents' -> 'visa' ->> 'path', '') = '' then
    raise exception 'visa not uploaded';
  end if;

  v_ts := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  update public.clients
     set data = v_client.data || jsonb_build_object(
                  'visaPublishedAt', v_ts,
                  'status', 'APPROVED',
                  'updatedAt', v_ts
                ),
         updated_at = now()
   where id = p_client_id;

  if v_client.user_id is not null then
    v_name := trim(both ' ' from
                 coalesce(v_client.data ->> 'firstName', '') || ' ' ||
                 coalesce(v_client.data ->> 'fatherName', '') || ' ' ||
                 coalesce(v_client.data ->> 'surname', ''));
    insert into public.notifications (user_id, type, payload, link)
    values (
      v_client.user_id,
      'visa_published',
      jsonb_build_object(
        'clientId', v_client.id,
        'fileNo', coalesce(v_client.data ->> 'fileNo', ''),
        'name', v_name
      ),
      '/clients/' || v_client.id::text
    );
  end if;

  return (select data from public.clients where id = p_client_id);
end;
$$;

revoke execute on function public.publish_visa(uuid) from anon;
grant execute on function public.publish_visa(uuid) to authenticated;
