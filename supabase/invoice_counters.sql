-- ============================================================
-- Shared invoice-number counter.
--
-- The previous logic built the next number by scanning the caller's own
-- invoices, which Row Level Security narrows to that user alone. Two
-- users creating invoices therefore received the same number, and even
-- one user working over time could collide with a colleague because
-- neither could see the other's rows.
--
-- This table is the single source of truth. `next_invoice_number`
-- increments it atomically and returns the formatted value, so every
-- number is handed out exactly once. `invoice_number_exists` answers
-- across all users, which the RLS-filtered client query could not.
-- ============================================================

create table if not exists public.invoice_counters (
  key        text primary key,
  last_seq   integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.invoice_counters enable row level security;

drop policy if exists "auth read" on public.invoice_counters;
create policy "auth read" on public.invoice_counters
  for select using (auth.uid() is not null);

-- Reserve the next number for a prefix ('INV' -> 'INV-2026-0001').
-- SECURITY DEFINER so the first-use seed can read every user's invoices.
create or replace function public.next_invoice_number(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_seq integer;
  v_max integer;
begin
  v_key := p_prefix || '-' || to_char(now(), 'YYYY');

  update public.invoice_counters
     set last_seq = last_seq + 1,
         updated_at = now()
   where key = v_key
  returning last_seq into v_seq;

  if v_seq is null then
    -- First invoice for this prefix-year: continue from any number that
    -- already exists, so the counter never issues a value that predates it.
    select coalesce(max(
      case when data->>'invoiceNumber' ~ ('^' || v_key || '-[0-9]+$')
        then split_part(data->>'invoiceNumber', '-', 3)::integer
      end
    ), 0)
    into v_max
    from public.invoices
    where data->>'invoiceNumber' like v_key || '-%';

    insert into public.invoice_counters (key, last_seq)
    values (v_key, v_max + 1)
    on conflict (key) do update
      set last_seq = invoice_counters.last_seq + 1,
          updated_at = now()
    returning last_seq into v_seq;
  end if;

  return v_key || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- True when any invoice, owned by any user, already uses this number.
create or replace function public.invoice_number_exists(p_number text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invoices where data->>'invoiceNumber' = p_number
  );
$$;

revoke execute on function public.next_invoice_number(text) from public;
revoke execute on function public.invoice_number_exists(text) from public;
grant execute on function public.next_invoice_number(text) to authenticated;
grant execute on function public.invoice_number_exists(text) to authenticated;
