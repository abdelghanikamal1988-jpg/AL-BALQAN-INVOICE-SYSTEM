/**
 * Client file number generation.
 *
 * Format: FILE-YYYY-DDMM<sequence>   e.g. FILE-2026-21101
 *   2026 = year, 2110 = day 21 / month 10, 1 = first file opened that day.
 * The sequence restarts every day and counts 1, 2, 3 ... (no padding), so a
 * number always tells you when the paper file was opened.
 *
 * The count comes from the shared server-side counter the invoice numbers
 * use, so Row Level Security can never hand the same number to two people.
 * That counter always appends the year itself and pads the sequence to four
 * digits ('FILE-2110' -> 'FILE-2110-2026-0001'), so it is called with the
 * day/month part only and the result is re-assembled into the file format
 * above. The random fallback only runs when the counter is unreachable and
 * uses a five-digit tail, which a real daily sequence cannot reach.
 */

import { supabase } from '../lib/supabase.js';

const FILE_PREFIX = 'FILE';

/** 'FILE-2110' for 21 October — the counter key for that day. */
export function fileNumberDayPrefix(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${FILE_PREFIX}-${dd}${mm}`;
}

/** 'FILE-2110-2026-0007' -> 'FILE-2026-21107'; anything else -> ''. */
export function fileNumberFromCounter(raw) {
  const parts = String(raw || '').split('-');
  if (parts.length !== 4 || parts[0] !== FILE_PREFIX) return '';
  const seq = parseInt(parts[3], 10);
  if (!Number.isFinite(seq) || seq < 1) return '';
  return `${parts[0]}-${parts[2]}-${parts[1]}${seq}`;
}

export async function nextFileNumber() {
  const now = new Date();

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('next_invoice_number', {
        p_prefix: fileNumberDayPrefix(now),
      });
      const fileNo = fileNumberFromCounter(data);
      if (!error && fileNo) return fileNo;
      console.warn('File number counter failed:', error?.message || 'bad value');
    } catch (err) {
      console.warn('File number counter failed:', err);
    }
  }

  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const tail = Math.floor(10000 + Math.random() * 90000);
  return `${FILE_PREFIX}-${now.getFullYear()}-${dd}${mm}${tail}`;
}
