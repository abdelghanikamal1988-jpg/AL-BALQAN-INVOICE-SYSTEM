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
    .select('data, user_id, deleted_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row, index) => ({
    ...row.data,
    createdBy: row.user_id || null,
    rowIndex: index,
  }));
}

export async function dbFetchOne(id) {
  const { data, error } = await supabase
    .from('invoices')
    .select('data')
    .eq('data->>id', id)
    .is('deleted_at', null)
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
    .eq('data->>id', id)
    .is('deleted_at', null)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Invoice not found or not permitted to update.');
  }
  return data[0].data;
}

/** Soft delete: the row is stamped, never removed, so it can be restored. */
export async function dbDelete(id) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('data->>id', id)
    .is('deleted_at', null)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No invoice was deleted. Check the UPDATE policy in Supabase (supabase/schema.sql).');
  }
}

/** Brings a soft-deleted invoice back. */
export async function dbRestore(id) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ deleted_at: null })
    .eq('data->>id', id)
    .not('deleted_at', 'is', null)
    .select('id');
  if (error) throw error;
  return (data || []).length > 0;
}

/** Invoices that were soft-deleted, for the admin recycle bin. */
export async function dbFetchDeleted() {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, data, deleted_at, created_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    rowId: row.id,
    deletedAt: row.deleted_at,
    ...row.data,
  }));
}

export async function dbInsertMany(invoices) {
  const userId = await currentUserId();
  const rows = invoices.map((inv) => ({ user_id: userId, data: inv }));
  const { error } = await supabase.from('invoices').insert(rows);
  if (error) throw error;
}