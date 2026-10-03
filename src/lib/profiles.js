/**
 * Display-name lookups for the User columns in the invoice/client lists.
 *
 * Profiles are readable for your own row and (thanks to admin.sql) for
 * admins — exactly the two cases the lists need. Failures degrade to the
 * fallback shown by the caller instead of breaking the list.
 */

import { supabase } from './supabase.js';

/** ids[] → { [id]: 'Full Name or email' } */
export async function loadUserNames(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))].map(String);
  const names = {};
  if (unique.length === 0) return names;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', unique);
  if (error) {
    console.warn('[profiles] name lookup unavailable:', error.message);
    return names;
  }
  (data || []).forEach((row) => {
    names[row.id] = String(row.full_name || row.email || '').trim();
  });
  return names;
}
