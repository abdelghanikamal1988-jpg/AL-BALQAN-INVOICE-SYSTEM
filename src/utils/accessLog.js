/**
 * Access log — every sign-in / sign-out attempt (successful or not) is
 * written to the `access_logs` table so the dashboard can show who used
 * the system and when, from any device.
 *
 * Writes go through the `log_access` SECURITY DEFINER function so a failed
 * sign-in (no session yet) is still recorded. Logging must never break
 * auth, so every call is fire-and-forget.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

const MAX = 200;

export async function getAccessLogs() {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('access_logs')
      .select('id, action, account, details, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX);
    if (error) {
      console.warn('[accessLog] load failed', error.message);
      return [];
    }
    return (data || []).map((row) => ({
      id: row.id,
      ts: row.created_at,
      action: row.action,
      account: row.account,
      details: row.details,
    }));
  } catch (err) {
    return [];
  }
}

export function recordAccess({ action, account = '', details = '' }) {
  if (!isSupabaseConfigured) return;
  try {
    supabase
      .rpc('log_access', {
        p_action: action,
        p_account: String(account || '').trim() || '—',
        p_details: details,
      })
      .then(({ error }) => {
        if (error) console.warn('[accessLog] write failed', error.message);
      });
  } catch (err) {
    /* storage unavailable — logging must never break auth */
  }
}
