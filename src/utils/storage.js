/**
 * Local Storage service — the ONLY place that touches localStorage.
 *
 * The UI never reads/writes localStorage directly. This layer can be
 * swapped in the future for a REST API, Supabase or Firebase without
 * rewriting the UI components.
 *
 * Keys:
 *  - albalqan_invoices        -> array of invoices
 *  - albalqan_invoice_draft   -> unfinished invoice draft
 */

import { formatDate, formatTime } from './formatDate.js';
import { calculateVat, VAT_MODE } from './vat.js';

const INVOICES_KEY = 'albalqan_invoices';
const DRAFT_KEY = 'albalqan_invoice_draft';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Storage may be full or unavailable — let callers handle gracefully.
    throw err;
  }
}

/* ----------------------- Invoices ----------------------- */

export function getInvoices() {
  const list = read(INVOICES_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function getInvoiceById(id) {
  return getInvoices().find((inv) => inv.id === id) || null;
}

function persistAll(list) {
  write(INVOICES_KEY, list);
}

export function saveInvoice(invoice) {
  const list = getInvoices();
  list.unshift(invoice);
  persistAll(list);
  return invoice;
}

export function updateInvoice(invoice) {
  const list = getInvoices();
  const idx = list.findIndex((inv) => inv.id === invoice.id);
  if (idx === -1) return null;
  list[idx] = invoice;
  persistAll(list);
  return invoice;
}

export function deleteInvoice(id) {
  const list = getInvoices().filter((inv) => inv.id !== id);
  persistAll(list);
}

/**
 * Case-insensitive search across invoice number, customer name,
 * passport number and phone number.
 */
export function searchInvoices(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return getInvoices();
  return getInvoices().filter((inv) => {
    const haystack = [
      inv.invoiceNumber,
      inv.customer?.name,
      inv.customer?.passport,
      inv.customer?.phone,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function importInvoices(incoming) {
  const list = getInvoices();
  const existingIds = new Set(list.map((inv) => inv.id));
  let added = 0;
  incoming.forEach((inv) => {
    if (inv && inv.id && !existingIds.has(inv.id)) {
      existingIds.add(inv.id);
      list.push(inv);
      added += 1;
    }
  });
  persistAll(list);
  return added;
}

/* ----------------------- Draft ----------------------- */

export function getDraft() {
  return read(DRAFT_KEY, null);
}

export function saveDraft(draft) {
  write(DRAFT_KEY, draft);
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (err) {
    /* ignore */
  }
}

/* ----------------------- In-memory helpers ----------------------- */

export function createInvoiceObject(formData, number) {
  const now = new Date();
  const vatMode = formData.vatMode || VAT_MODE.NONE;
  const vat = calculateVat(formData.total, vatMode);
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `inv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    invoiceNumber: number,
    issueDate: formatDate(now),
    issueTime: formatTime(now),
    customer: {
      name: formData.name,
      nationality: formData.nationality,
      passport: formData.passport,
      phone: formData.phone,
      email: formData.email,
    },
    travel: {
      destination: formData.destination,
      service: formData.service,
      residenceType: formData.residenceType,
    },
    payment: {
      total: formData.total,
      vatMode,
      vat: vat.vat,
      subtotal: vat.subtotal,
      grandTotal: vat.grandTotal,
      paid: formData.paid,
    },
    notes: formData.notes,
  };
}
