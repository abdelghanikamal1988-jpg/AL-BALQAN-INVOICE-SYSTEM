import { supabase } from './supabase.js';

const TABLE = 'audit_log';

function requireClient() {
  if (!supabase) {
    const error = new Error('supabase_not_configured');
    error.code = 'supabase_not_configured';
    throw error;
  }
  return supabase;
}

/**
 * Recent audit entries. RLS decides the scope: an admin reads every
 * user's rows, an employee reads only their own.
 */
export async function dbFetchAuditLog({ limit = 100, offset = 0, table = '', action = '' } = {}) {
  const client = requireClient();
  let query = client
    .from(TABLE)
    .select('id, user_id, table_name, record_id, action, changed_keys, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (table) query = query.eq('table_name', table);
  if (action) query = query.eq('action', action);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** How many audit rows exist (for the "load more" button). */
export async function dbCountAuditLog({ table = '', action = '' } = {}) {
  const client = requireClient();
  let query = client
    .from(TABLE)
    .select('id', { count: 'exact', head: true });
  if (table) query = query.eq('table_name', table);
  if (action) query = query.eq('action', action);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

/** Maps auth user ids to display names for the log table. */
export async function dbFetchAuditUsers(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return {};
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select('id, fullName, email')
    .in('id', unique);
  if (error) return {};
  const map = {};
  for (const row of data || []) {
    map[row.id] = row.fullName || row.email || row.id;
  }
  return map;
}
