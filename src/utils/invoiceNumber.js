/**
 * Invoice number generation.
 * Format: INV-YYYY-XXXX  (e.g. INV-2026-0001)
 *
 * Numbers come from a shared server-side counter, not from scanning the
 * caller's own invoices. Row Level Security hides other users' rows, so
 * the old scan handed the same number to two people; the counter hands
 * each number out exactly once and keeps the sequence monotonic.
 */

import { supabase } from '../lib/supabase.js';
import { getSettings, sanitizeInvoicePrefix } from './settings.js';

async function allocateFromCounter() {
  const prefix = sanitizeInvoicePrefix(getSettings().invoicePrefix);
  const { data, error } = await supabase.rpc('next_invoice_number', {
    p_prefix: prefix,
  });
  if (error) throw error;
  return data;
}

export async function nextInvoiceNumber() {
  return allocateFromCounter();
}

/**
 * Guarantee a unique invoice number at save time.
 *
 * Editing keeps the invoice's existing number. Creating checks the number
 * against every user's invoices through a server-side helper — the client
 * query only sees its own rows — and allocates a fresh one when it is
 * already taken.
 */
export async function uniqueInvoiceNumber(proposedNumber, { ignoreId = null } = {}) {
  if (ignoreId) return proposedNumber;
  if (!proposedNumber) return allocateFromCounter();

  const { data: taken, error } = await supabase.rpc('invoice_number_exists', {
    p_number: proposedNumber,
  });
  if (error) throw error;
  if (!taken) return proposedNumber;
  return allocateFromCounter();
}
