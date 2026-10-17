-- ============================================================
-- AL BALQAN — Invoice payment ledger
-- Run this ONCE in: Supabase Dashboard -> SQL Editor -> Run
-- (Safe to re-run.)
--
-- The invoice keeps a denormalised payment.paid so the PDF, the
-- history table and the dashboard all keep working unchanged.
-- This table is the audit trail behind that number: every cent
-- is a row with a date, a method and an optional note.
-- ============================================================

create table if not exists public.invoice_payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  invoice_id uuid not null,
  amount     numeric(14, 2) not null check (amount > 0),
  method     text not null default 'CASH'
    check (method in ('CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER')),
  note       text not null default '',
  paid_at    date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists invoice_payments_invoice_id_idx
  on public.invoice_payments (invoice_id);

create index if not exists invoice_payments_user_id_idx
  on public.invoice_payments (user_id);

alter table public.invoice_payments enable row level security;

drop policy if exists "own select" on public.invoice_payments;
create policy "own select" on public.invoice_payments
  for select using (auth.uid() = user_id);

drop policy if exists "own insert" on public.invoice_payments;
create policy "own insert" on public.invoice_payments
  for insert with check (auth.uid() = user_id);

drop policy if exists "own update" on public.invoice_payments;
create policy "own update" on public.invoice_payments
  for update using (auth.uid() = user_id);

drop policy if exists "own delete" on public.invoice_payments;
create policy "own delete" on public.invoice_payments
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Totals helper: sum of every payment recorded for an invoice.
-- Kept server-side so the client never has to trust its own sum.
-- ============================================================
create or replace function public.invoice_paid_total(p_invoice_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::numeric(14, 2)
  from public.invoice_payments
  where invoice_id = p_invoice_id
    and user_id = auth.uid();
$$;
