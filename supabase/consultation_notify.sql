-- ============================================================
-- AL BALQAN — consultation bell notifications
-- Written by the netlify-forms Edge Function after a sync that
-- imported new requests (scheduled sync or a manual click), so
-- every active user who can act on consultations gets a durable
-- in-app row — not just whoever happened to have the tab open.
-- Safe to re-run: CREATE OR REPLACE + idempotent grants.
-- ============================================================

create or replace function public.notify_new_consultations(p_count integer, p_latest text default '')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  -- Who may announce: an active user holding the consultations page, or
  -- the scheduled server sync (service role — auth.uid() is null there).
  if auth.uid() is not null and not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active
      and (role = 'admin' or permissions @> '["page:consultations"]'::jsonb)
  ) then
    raise exception 'not authorized';
  end if;

  if coalesce(p_count, 0) <= 0 then
    return 0;
  end if;

  insert into public.notifications (user_id, type, payload, link)
  select id,
         'consultation_new',
         jsonb_build_object(
           'count', p_count,
           'latest', left(coalesce(p_latest, ''), 120)
         ),
         '/consultations'
  from public.profiles
  where is_active
    and (role = 'admin' or permissions @> '["page:consultations"]'::jsonb);

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke execute on function public.notify_new_consultations(integer, text) from public;
revoke execute on function public.notify_new_consultations(integer, text) from anon;
grant execute on function public.notify_new_consultations(integer, text) to authenticated;
grant execute on function public.notify_new_consultations(integer, text) to service_role;
