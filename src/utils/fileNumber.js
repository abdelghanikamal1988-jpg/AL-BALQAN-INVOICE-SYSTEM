/**
 * Client file number generation.
 * Format: FILE-YYYY-XXXX  (e.g. FILE-2026-0001)
 *
 * Every client gets one file number when it is first saved, and invoices
 * created for that client carry the same number, so the paper file and the
 * invoice can be filed together.
 *
 * The number comes from the same shared server-side counter the invoice
 * numbers use (a different prefix), so Row Level Security can never hand
 * the same file number to two people. The random fallback only runs when
 * the counter is unreachable - it uses a 5-digit tail, while the counter
 * pads to 4 digits, so the two formats can never collide.
 */

import { supabase } from '../lib/supabase.js';

const FILE_PREFIX = 'FILE';

export async function nextFileNumber() {
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('next_invoice_number', {
        p_prefix: FILE_PREFIX,
      });
      if (!error && data) return data;
      console.warn('File number counter failed:', error?.message || 'no data');
    } catch (err) {
      console.warn('File number counter failed:', err);
    }
  }
  const year = new Date().getFullYear();
  const tail = Math.floor(10000 + Math.random() * 90000);
  return `${FILE_PREFIX}-${year}-${tail}`;
}
