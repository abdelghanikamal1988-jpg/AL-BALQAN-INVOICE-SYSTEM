-- ============================================================
-- AL BALQAN — client file number: ONE running sequence
--
-- The old counter key carried the day ('FILE-2110-2026'), so the
-- sequence started again at 1 every morning and two different days
-- handed out the same tail. This counter has a single key for the
-- whole system: it is seeded ONCE from the highest file number that
-- was ever stored — every client row, including the soft-deleted
-- ones, plus the copies invoices keep — and from then on it only
-- goes up. Two accounts saving at the same moment therefore never
-- receive the same number, and a number is never reissued.
--
-- Safe to re-run: CREATE OR REPLACE + idempotent policy/grants.
-- ============================================================

create table if not exists public.file_counters (
  key        text primary key,
  last_seq   bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.file_counters enable row level security;

drop policy if exists "auth read" on public.file_counters;
create policy "auth read" on public.file_counters
  for select using (auth.uid() is not null);

-- p_prefix is the caller's 'FILE-DDMM' (the day the paper file was
-- opened). The sequence behind it deliberately ignores that day: it
-- is one running number, returned as 'FILE-2110-2026-0007' for the
-- app to assemble into FILE-2026-21107.
create or replace function public.next_file_number(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq bigint;
  v_max bigint;
begin
  update public.file_counters
     set last_seq = last_seq + 1,
         updated_at = now()
   where key = 'FILE'
  returning last_seq into v_seq;

  if v_seq is null then
    -- Seed from every file number ever issued (any day, any year,
    -- including the five-digit random tails the offline fallback
    -- used), so the first number of the new sequence is above them.
    select coalesce(max(f.seq), 0)
      into v_max
      from (
        select case
                 when coalesce(c.data ->> 'fileNo', '') ~ '^FILE-[0-9]{4}-[0-9]{4}[0-9]+$'
                 then substring(c.data ->> 'fileNo'
                                from '^FILE-[0-9]{4}-[0-9]{4}([0-9]+)$')::bigint
                 else 0
               end as seq
        from public.clients c
        union all
        select case
                 when coalesce(i.data -> 'client' ->> 'fileNo', '') ~ '^FILE-[0-9]{4}-[0-9]{4}[0-9]+$'
                 then substring(i.data -> 'client' ->> 'fileNo'
                                from '^FILE-[0-9]{4}-[0-9]{4}([0-9]+)$')::bigint
                 else 0
               end
        from public.invoices i
      ) f;

    insert into public.file_counters (key, last_seq)
    values ('FILE', v_max + 1)
    on conflict (key) do update
      set last_seq = file_counters.last_seq + 1,
          updated_at = now()
    returning last_seq into v_seq;
  end if;

  return p_prefix || '-' || to_char(now(), 'YYYY') || '-'
         || case when v_seq >= 10000 then v_seq::text
                 else lpad(v_seq::text, 4, '0') end;
end;
$$;

revoke execute on function public.next_file_number(text) from public;
revoke execute on function public.next_file_number(text) from anon;
grant execute on function public.next_file_number(text) to authenticated;
