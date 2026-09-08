/**
 * Supabase data access — the ONLY place that talks to the database.
 *
 * Invoices are stored as a single JSONB column (`data`) per row, so any
 * future change to the invoice shape does not require a migration.
 *
 * Table schema (run once in the Supabase SQL editor):
 *
 *   create table public.invoices (
 *     id         uuid primary key default gen_random_uuid(),
 *     user_id    uuid not null references auth.users(id) on delete cascade,
 *     data       jsonb not null,
 *     created_at timestamptz not null default now()
 *   );
 *
 *   alter table public.invoices enable row level security;
 *
 *   create policy "own select" on public.invoices
 *     for select using (auth.uid() = user_id);
 *   create policy "own insert" on public.invoices
 *     for insert with check (auth.uid() = user_id);
 *   create policy "own update" on public.invoices
 *     for update using (auth.uid() = user_id);
 *   create policy "own delete" on public.invoices
 *     for delete using (auth.uid() = user_id);
 */

import { supabase } from './supabase.js';

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

export async function dbFetchAll() {
  const { data, error } = await supabase
    .from('invoices')
    .select('data')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row, index) => ({
    ...row.data,
    rowIndex: index,
  }));
}

export async function dbFetchOne(id) {
  const { data, error } = await supabase
    .from('invoices')
    .select('data')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data.data, rowIndex: 0 };
}

export async function dbInsert(invoice) {
  const { data, error } = await supabase
    .from('invoices')
    .insert({ user_id: await currentUserId(), data: invoice })
    .select();
  if (error) throw error;
  return data?.[0]?.data || invoice;
}

export async function dbUpdateBackup(id, invoice) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ data: invoice })
    .eq('id', id)
    .select();
  if (error) throw error;
  return data?.[0]?.data || invoice;
}

export async function dbDelete(id) {
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw error;
}

export async function dbInsertMany(invoices) {
  const userId = await currentUserId();
  const rows = invoices.map((inv) => ({ user_id: userId, data: inv }));
  const { error } = await supabase.from('invoices').insert(rows);
  if (error) throw error;
}