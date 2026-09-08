/**
 * Invoice number generation.
 * Format: INV-YYYY-XXXX  (e.g. INV-2026-0001)
 */

import { getInvoices } from './storage.js';

export async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const invoices = await getInvoices();
  const prefix = `INV-${year}-`;

  let maxSeq = 0;
  invoices.forEach((inv) => {
    if (inv.invoiceNumber && inv.invoiceNumber.startsWith(prefix)) {
      const seq = parseInt(inv.invoiceNumber.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  });

  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

/**
 * Guarantee a unique invoice number at save time.
 * If the proposed number already exists, generate a new one.
 */
export async function uniqueInvoiceNumber(proposedNumber, { ignoreId = null } = {}) {
  const invoices = await getInvoices();
  const exists = invoices.some(
    (inv) =>
      inv.invoiceNumber === proposedNumber && inv.id !== ignoreId
  );
  if (!exists) return proposedNumber;
  return nextInvoiceNumber();
}