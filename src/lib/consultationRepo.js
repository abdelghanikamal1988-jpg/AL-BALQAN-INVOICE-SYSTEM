import { supabase } from './supabase.js';

const TABLE = 'consultation_requests';

function requireClient() {
  if (!supabase) {
    const error = new Error('supabase_not_configured');
    error.code = 'supabase_not_configured';
    throw error;
  }
  return supabase;
}

/** All requests for the signed-in user, newest first. */
export async function dbFetchConsultations() {
  const client = requireClient();
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .order('submitted_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

/** Status / notes managed inside the system. */
export async function dbUpdateConsultation(id, patch) {
  const client = requireClient();
  const { error } = await client
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Calls our Edge Function, which talks to the Netlify API with the
 * secret token. Returns { synced_new, total_fetched, last_submission_at }.
 */
export async function syncNetlifyForms() {
  const client = requireClient();
  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const { data, error } = await client.functions.invoke('netlify-forms', {
    method: 'POST',
    body: { action: 'submissions' },
    ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
  });
  if (error) {
    const failure = new Error(error.message || 'sync_failed');
    failure.name = error.name || 'FunctionsHttpError';
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json();
        if (body?.detail) failure.message = body.detail;
        else if (body?.error) failure.message = body.error;
        failure.code = body?.error || undefined;
      } catch {
        /* non-JSON error body */
      }
    }
    throw failure;
  }
  return data || {};
}
