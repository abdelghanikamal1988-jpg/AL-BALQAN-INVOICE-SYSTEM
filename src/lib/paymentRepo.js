import { supabase } from './supabase.js';

const TABLE = 'invoice_payments';

export const PAYMENT_METHODS = [
  'CASH',
  'BANK_TRANSFER',
  'CARD',
  'CHEQUE',
  'OTHER',
];

function requireClient() {
  if (!supabase) {
    const error = new Error('supabase_not_configured');
    error.code = 'supabase_not_configured';
    throw error;
  }
  return supabase;
}

/** Every payment recorded for one invoice, oldest first. */
export async function dbFetchPayments(invoiceId) {
  const client = requireClient();
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('paid_at', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Appends one payment and returns the inserted row. */
export async function dbAddPayment({ invoiceId, amount, method, note, paidAt }) {
  const client = requireClient();
  const { data, error } = await client
    .from(TABLE)
    .insert({
      invoice_id: invoiceId,
      amount: Number(amount),
      method: PAYMENT_METHODS.includes(method) ? method : 'CASH',
      note: String(note || '').trim(),
      paid_at: paidAt || new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Removes one payment row. */
export async function dbDeletePayment(id) {
  const client = requireClient();
  const { error } = await client.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/**
 * Rebuilds an invoice's payment.paid from the ledger so the denormalised
 * number on the invoice can never drift away from the recorded rows.
 * Returns the new paid total.
 */
export async function dbSyncInvoicePaid(invoiceId, updateInvoiceFn) {
  const rows = await dbFetchPayments(invoiceId);
  const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const rounded = Math.round(total * 100) / 100;
  if (typeof updateInvoiceFn === 'function') await updateInvoiceFn(rounded);
  return rounded;
}
