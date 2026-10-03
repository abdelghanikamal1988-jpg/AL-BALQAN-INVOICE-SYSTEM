/**
 * Supabase data access for the edit-approval workflow (pending_edits).
 *
 * A non-admin user's EDIT to an invoice/client is stored here as a
 * proposal (`pending`) instead of being written to the record. An admin
 * applies it (approve) or discards it (reject); until then the original
 * values stay untouched.
 *
 * Table: supabase/approvals.sql  (run once, after admin.sql).
 */

import { supabase } from './supabase.js';
import { dbUpdateBackup } from './invoiceRepo.js';
import { dbFetchClient, dbUpdateClient } from './clientRepo.js';

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

/** Submits an edit proposal. Replaces any earlier pending proposal of the
 *  same user for the same record (editing twice keeps only the latest). */
export async function dbSubmitPending(entityType, entityId, payload) {
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in to submit changes.');

  const key = {
    entity_type: entityType,
    entity_id: String(entityId),
    user_id: userId,
    status: 'pending',
  };

  const { error: removeError } = await supabase.from('pending_edits').delete().match(key);
  if (removeError) throw removeError;

  const { data, error } = await supabase
    .from('pending_edits')
    .insert({
      user_id: userId,
      entity_type: entityType,
      entity_id: String(entityId),
      payload,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Proposals visible to the current user (own) or to admins (all).
 *  status: 'pending' (default) | 'approved' | 'rejected' | 'any'. */
export async function dbFetchPending(entityType, { status = 'pending' } = {}) {
  let query = supabase
    .from('pending_edits')
    .select('*')
    .order('created_at', { ascending: false });
  if (entityType) query = query.eq('entity_type', entityType);
  if (status && status !== 'any') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** Owner withdraws their own proposal (admins can remove any). */
export async function dbWithdrawPending(id) {
  const { error } = await supabase.from('pending_edits').delete().eq('id', id);
  if (error) throw error;
}

/** Admin rejects a proposal — the record keeps its current values and the
 *  proposal keeps its submitted values (it simply leaves the pending queue). */
export async function dbRejectPending(id) {
  const userId = await currentUserId();
  const { error } = await supabase
    .from('pending_edits')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: userId })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Admin approves a proposal: writes the payload onto the real record,
 * stamps who edited it, removes client files the proposal no longer
 * references, and closes every other pending proposal for that record.
 * If applying fails, the proposal stays `pending` for a retry.
 */
export async function dbApprovePending(pending) {
  const userId = await currentUserId();
  const reviewedAt = new Date().toISOString();
  const payload = { ...pending.payload, editedBy: pending.user_id, editedAt: reviewedAt };

  if (pending.entity_type === 'invoice') {
    await dbUpdateBackup(pending.entity_id, payload);
  } else {
    const current = await dbFetchClient(pending.entity_id);
    if (!current) throw new Error('Client no longer exists.');
    await dbUpdateClient(payload);

    // Files replaced or removed by the proposal: drop the old objects once
    // the new metadata is live (uploads happen at submit time, so only the
    // previous paths can be cleaned up here).
    try {
      const nextPaths = new Set(
        Object.values(payload.documents || {})
          .filter((doc) => doc && doc.path)
          .map((doc) => doc.path)
      );
      const stale = Object.values(current.documents || {})
        .filter((doc) => doc && doc.path && !nextPaths.has(doc.path))
        .map((doc) => doc.path);
      if (stale.length > 0) await supabase.storage.from('client-documents').remove(stale);
    } catch (err) {
      console.warn('[pending] old document cleanup failed:', err);
    }
  }

  // Only one proposal per record may survive approval.
  const { error: supersedeError } = await supabase
    .from('pending_edits')
    .update({ status: 'rejected', reviewed_at: reviewedAt, reviewed_by: userId })
    .match({ entity_type: pending.entity_type, entity_id: pending.entity_id, status: 'pending' })
    .neq('id', pending.id);
  if (supersedeError) throw supersedeError;

  const { error } = await supabase
    .from('pending_edits')
    .update({ status: 'approved', reviewed_at: reviewedAt, reviewed_by: userId })
    .eq('id', pending.id);
  if (error) throw error;
}
