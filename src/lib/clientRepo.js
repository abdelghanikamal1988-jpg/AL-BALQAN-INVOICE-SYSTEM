/**
 * Supabase data access for the Client module.
 *
 * Same pattern as invoiceRepo.js: the whole record lives in one JSONB
 * column, so the invoice tables/logic are never touched.
 *
 * NOTE: the client id is generated in the app and written BOTH as the row
 * primary key and inside `data.id`, so they can never drift apart.
 */

import { supabase } from './supabase.js';

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

/* ----------------------------- Clients ----------------------------- */

export async function dbFetchClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('data, user_id')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({ ...row.data, createdBy: row.user_id || null }));
}

export async function dbFetchClient(id) {
  const { data, error } = await supabase
    .from('clients')
    .select('data')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? data.data : null;
}

export async function dbInsertClient(client) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('clients')
    .insert({ id: client.id, user_id: userId, data: client })
    .select();
  if (error) throw error;
  return data?.[0]?.data || client;
}

export async function dbUpdateClient(client) {
  const { data, error } = await supabase
    .from('clients')
    .update({ data: client, updated_at: new Date().toISOString() })
    .eq('id', client.id)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Client not found.');
  return data[0].data;
}

export async function dbDeleteClient(id) {
  const { data, error } = await supabase.from('clients').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No client was deleted. Check the DELETE policy in Supabase (supabase/clients.sql).');
  }
}

/* -------------------------- Referral agents -------------------------- */

export async function dbFetchAgents() {
  const { data, error } = await supabase
    .from('referral_agents')
    .select('id, name, created_at')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function dbInsertAgent(name) {
  const userId = await currentUserId();
  const trimmed = String(name || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) throw new Error('Agent name is required.');
  const existing = await dbFetchAgents();
  const duplicate = existing.some((a) => a.name.toLowerCase() === trimmed.toLowerCase());
  if (duplicate) throw new Error('That agent already exists.');
  const { data, error } = await supabase
    .from('referral_agents')
    .insert({ user_id: userId, name: trimmed })
    .select();
  if (error) throw error;
  return data?.[0] || { name: trimmed };
}

export async function dbDeleteAgent(id) {
  const { error } = await supabase.from('referral_agents').delete().eq('id', id);
  if (error) throw error;
}
